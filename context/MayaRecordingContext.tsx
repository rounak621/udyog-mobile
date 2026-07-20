import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import {
  AndroidOutputFormat,
  AndroidAudioEncoder,
  IOSOutputFormat,
  IOSAudioQuality,
} from 'expo-av/build/Audio/RecordingConstants';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';

// Voice-optimized recording preset: 16kHz mono 64kbps AAC
// Produces ~4x smaller files than HIGH_QUALITY (44.1kHz stereo 128kbps)
// while maintaining excellent speech transcription accuracy.
const VOICE_OPTIMIZED_PRESET: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.m4a',
    outputFormat: AndroidOutputFormat.MPEG_4,
    audioEncoder: AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: IOSAudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface MayaSession {
  businessId: string;
  conversationHistory: React.MutableRefObject<ChatMessage[]>;
  getToken: () => Promise<string | null>;
  onResponse: (response: any) => void;
  onTranscript?: (transcript: string) => void;
  onError: (errorType: 'permission' | 'network' | 'backend' | 'empty' | 'general', message: string) => void;
}

interface MayaRecordingContextType {
  isRecording: boolean;
  isMayaScreenActive: boolean;
  setMayaScreenActive: (active: boolean) => void;
  startRecording: () => Promise<void>;
  stopRecording: (
    businessId?: string,
    history?: ChatMessage[],
    getToken?: () => Promise<string | null>,
    onResponse?: (response: any) => void,
    onTranscript?: (transcript: string) => void,
    onError?: (errorType: 'permission' | 'network' | 'backend' | 'empty' | 'general', message: string) => void
  ) => Promise<void>;
  isProcessing: boolean;
  registerSession: (session: MayaSession) => void;
  clearSession: () => void;
}

const MayaRecordingContext = createContext<MayaRecordingContextType | undefined>(undefined);

export function MayaRecordingProvider({ children }: { children: ReactNode }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMayaScreenActive, setMayaScreenActive] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const sessionRef = useRef<MayaSession | null>(null);
  const recordingStartTimestampRef = useRef<number | null>(null);

  const registerSession = (session: MayaSession) => {
    sessionRef.current = session;
  };

  const clearSession = () => {
    sessionRef.current = null;
  };

  // Helper to safely unload a recording instance and prevent double unload crashes
  const safeUnloadRecording = async (recording: Audio.Recording | null): Promise<string | null> => {
    if (!recording) return null;

    if ((recording as any)._unloaded) {
      return recording.getURI();
    }
    (recording as any)._unloaded = true;

    try {
      const status = await recording.getStatusAsync();
      if (status.canRecord || status.isRecording) {
        await recording.stopAndUnloadAsync();
      }
    } catch (err: any) {
      if (err.message?.includes('already been unloaded') || err.message?.includes('already unloaded')) {
        console.log('[MayaRecordingContext] Recording was already unloaded (caught gracefully)');
      } else if (err.message?.includes('no valid audio data')) {
        console.log('[MayaRecordingContext] Recording too short / no valid audio data (caught gracefully)');
        throw err;
      } else {
        console.warn('[MayaRecordingContext] Error safe unloading recording:', err.message || err);
      }
    }
    return recording.getURI();
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microphone Permission Required',
          'Udyog needs microphone access to record voice commands and create bills.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (recordingRef.current) {
        const prevRecording = recordingRef.current;
        recordingRef.current = null;
        try {
          await safeUnloadRecording(prevRecording);
        } catch (cleanupErr) {
          console.log('Error cleaning up previous recording instance:', cleanupErr);
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      recordingStartTimestampRef.current = Date.now();
      const { recording: newRecording } = await Audio.Recording.createAsync(
        VOICE_OPTIMIZED_PRESET
      );
      recordingRef.current = newRecording;
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to initialize recording.');
    }
  };

  const stopRecording = async (
    businessId?: string,
    history?: ChatMessage[],
    getToken?: () => Promise<string | null>,
    onResponse?: (response: any) => void,
    onTranscript?: (transcript: string) => void,
    onError?: (errorType: 'permission' | 'network' | 'backend' | 'empty' | 'general', message: string) => void
  ) => {
    const rec = recordingRef.current;
    if (!rec) {
      setIsRecording(false);
      return;
    }

    // Nullify immediately to prevent concurrent duplicate calls/double unloads
    recordingRef.current = null;
    setIsRecording(false);

    // Resolve upload parameters: use explicit args if provided, otherwise fall back to registered session
    let resolvedBusinessId = businessId;
    let resolvedHistory = history;
    let resolvedGetToken = getToken;
    let resolvedOnResponse = onResponse;
    let resolvedOnTranscript = onTranscript;
    let resolvedOnError = onError;

    if (!resolvedBusinessId && sessionRef.current) {
      resolvedBusinessId = sessionRef.current.businessId;
      // Read the live ref value so we always get current conversation history
      resolvedHistory = sessionRef.current.conversationHistory.current;
      resolvedGetToken = sessionRef.current.getToken;
      resolvedOnResponse = sessionRef.current.onResponse;
      resolvedOnTranscript = sessionRef.current.onTranscript;
      resolvedOnError = sessionRef.current.onError;
    }

    // Only treat as a true cancel if there's genuinely no session available AND no explicit parameters
    if (!resolvedBusinessId || !resolvedHistory || !resolvedGetToken || !resolvedOnResponse || !resolvedOnError) {
      try {
        await safeUnloadRecording(rec);
      } catch (e) {
        console.error('Failed to stop recording on tab release', e);
      }
      return;
    }

    // Prevent accidental brief taps from uploading (minimum hold duration)
    // 700ms total elapsed from touch start (roughly 300ms hold + 400ms delay)
    const duration = recordingStartTimestampRef.current ? (Date.now() - recordingStartTimestampRef.current) : 0;
    if (duration < 700) {
      try {
        await safeUnloadRecording(rec);
      } catch (e) { /* ignore */ }
      setIsProcessing(false);
      resolvedOnError('empty', 'Recording too short, please hold and speak.');
      return;
    }

    setIsProcessing(true);

    // ── Timing markers for latency diagnosis ──
    const t0 = Date.now();
    console.log('[Maya-Latency] Phase 0: Starting recording teardown');

    try {
      const uri = await safeUnloadRecording(rec);
      const t1 = Date.now();
      console.log(`[Maya-Latency] Phase 1: Recording stopped (${t1 - t0}ms)`);

      if (!uri) {
        setIsProcessing(false);
        resolvedOnError('empty', 'Recording was empty or could not be saved.');
        return;
      }

      // Measure file size using the new File class (getInfoAsync is deprecated)
      let fileSizeKB = 'unknown';
      let fileSizeVal = 0;
      try {
        const file = new FileSystem.File(uri);
        if (file.exists) {
          fileSizeVal = file.size;
          fileSizeKB = `${Math.round(fileSizeVal / 1024)}KB`;
        } else {
          fileSizeKB = 'not_found';
        }
      } catch (err: any) {
        console.log('[Maya-Latency] Error reading file size:', err.message || err);
      }
      const t2 = Date.now();
      console.log(`[Maya-Latency] Phase 2: File ready, size=${fileSizeKB} (${t2 - t0}ms total)`);

      const token = await resolvedGetToken();
      const t3 = Date.now();
      console.log(`[Maya-Latency] Phase 3: Token acquired (${t3 - t2}ms, ${t3 - t0}ms total)`);

      // 1. STEP 1: Fast STT Transcription
      const transcribeFormData = new FormData();
      transcribeFormData.append('audio_format', 'audio/mp4');
      const filename = uri.split('/').pop() || 'recording.m4a';
      transcribeFormData.append('audio', {
        uri,
        name: filename,
        type: 'audio/mp4',
      } as any);

      const headers: any = {
        'Content-Type': 'multipart/form-data',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log(`[Maya-Latency] Phase 4: Starting fast transcription request...`);
      const transcribeResponse = await axios.post(
        'https://api.udyogbook.in/api/v1/ai/transcribe',
        transcribeFormData,
        { headers, timeout: 30000 }
      );
      const tTranscribe = Date.now();
      console.log(`[Maya-Latency] Phase 4.5: Transcription received in ${tTranscribe - t3}ms`);

      const transcript = transcribeResponse.data?.user_transcript;
      if (!transcript) {
        throw new Error("Empty transcript returned from transcription endpoint.");
      }

      // Update frontend immediately with the real transcript
      if (resolvedOnTranscript) {
        resolvedOnTranscript(transcript);
      }

      // 2. STEP 2: Chat Reasoning call
      console.log(`[Maya-Latency] Phase 5: Starting chat reasoning request...`);
      const chatFormData = new FormData();
      chatFormData.append('business_id', resolvedBusinessId);
      chatFormData.append('text', transcript);
      chatFormData.append('conversation_history', JSON.stringify(resolvedHistory));

      const chatResponse = await axios.post(
        'https://api.udyogbook.in/api/v1/ai/maya-chat',
        chatFormData,
        { headers, timeout: 60000 }
      );
      const tReasoning = Date.now();
      console.log(`[Maya-Latency] Phase 5.5: Reasoning received in ${tReasoning - tTranscribe}ms (Total round-trip=${tReasoning - t0}ms)`);

      if (chatResponse.data) {
        resolvedOnResponse(chatResponse.data);
      } else {
        resolvedOnError('backend', 'Backend returned empty response.');
      }
    } catch (err: any) {
      const tErr = Date.now();
      console.error(`[Maya-Latency] ERROR at ${tErr - t0}ms:`, err.message || err);
      
      const isTranscriptionError = !resolvedHistory || err.config?.url?.includes('/transcribe');
      
      if (isTranscriptionError) {
        resolvedOnError('backend', "Couldn't understand your voice, please try again.");
      } else {
        const backendMessage = err.response?.data?.detail;
        if (backendMessage) {
          resolvedOnError('backend', backendMessage);
        } else if (err.request) {
          resolvedOnError('network', 'Could not connect to Maya. Please check your internet connection.');
        } else {
          resolvedOnError('general', err.message || 'Something went wrong.');
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <MayaRecordingContext.Provider
      value={{
        isRecording,
        isMayaScreenActive,
        setMayaScreenActive,
        startRecording,
        stopRecording,
        isProcessing,
        registerSession,
        clearSession,
      }}
    >
      {children}
    </MayaRecordingContext.Provider>
  );
}

export function useMayaRecording() {
  const context = useContext(MayaRecordingContext);
  if (!context) {
    throw new Error('useMayaRecording must be used within a MayaRecordingProvider');
  }
  return context;
}
