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

  const registerSession = (session: MayaSession) => {
    sessionRef.current = session;
  };

  const clearSession = () => {
    sessionRef.current = null;
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
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (cleanupErr) {
          console.log('Error cleaning up previous recording instance:', cleanupErr);
        }
        recordingRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

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
    onError?: (errorType: 'permission' | 'network' | 'backend' | 'empty' | 'general', message: string) => void
  ) => {
    if (!recordingRef.current) {
      setIsRecording(false);
      return;
    }

    setIsRecording(false);

    // Resolve upload parameters: use explicit args if provided, otherwise fall back to registered session
    let resolvedBusinessId = businessId;
    let resolvedHistory = history;
    let resolvedGetToken = getToken;
    let resolvedOnResponse = onResponse;
    let resolvedOnError = onError;

    if (!resolvedBusinessId && sessionRef.current) {
      resolvedBusinessId = sessionRef.current.businessId;
      // Read the live ref value so we always get current conversation history
      resolvedHistory = sessionRef.current.conversationHistory.current;
      resolvedGetToken = sessionRef.current.getToken;
      resolvedOnResponse = sessionRef.current.onResponse;
      resolvedOnError = sessionRef.current.onError;
    }

    // Only treat as a true cancel if there's genuinely no session available AND no explicit parameters
    if (!resolvedBusinessId || !resolvedHistory || !resolvedGetToken || !resolvedOnResponse || !resolvedOnError) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      } catch (e) {
        console.error('Failed to stop recording on tab release', e);
      }
      return;
    }

    setIsProcessing(true);

    // ── Timing markers for latency diagnosis ──
    const t0 = Date.now();
    console.log('[Maya-Latency] Phase 0: Starting recording teardown');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const t1 = Date.now();
      console.log(`[Maya-Latency] Phase 1: Recording stopped (${t1 - t0}ms)`);

      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        setIsProcessing(false);
        resolvedOnError('empty', 'Recording was empty or could not be saved.');
        return;
      }

      // Measure file size
      let fileSizeKB = 'unknown';
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists && 'size' in fileInfo) {
          fileSizeKB = `${Math.round((fileInfo.size || 0) / 1024)}KB`;
        }
      } catch (_e) { /* non-critical */ }
      const t2 = Date.now();
      console.log(`[Maya-Latency] Phase 2: File ready, size=${fileSizeKB} (${t2 - t0}ms total)`);

      const token = await resolvedGetToken();
      const t3 = Date.now();
      console.log(`[Maya-Latency] Phase 3: Token acquired (${t3 - t2}ms, ${t3 - t0}ms total)`);

      const formData = new FormData();
      formData.append('business_id', resolvedBusinessId);
      formData.append('audio_format', 'audio/mp4');
      formData.append('conversation_history', JSON.stringify(resolvedHistory));

      const filename = uri.split('/').pop() || 'recording.m4a';
      formData.append('audio', {
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

      console.log(`[Maya-Latency] Phase 4: Starting upload...`);
      const response = await axios.post('https://api.udyogbook.in/api/v1/ai/maya-command', formData, {
        headers,
        timeout: 60000,
      });
      const t4 = Date.now();
      console.log(`[Maya-Latency] Phase 5: Response received (upload+backend=${t4 - t3}ms, total=${t4 - t0}ms)`);

      if (response.data) {
        resolvedOnResponse(response.data);
      } else {
        resolvedOnError('backend', 'Backend returned empty response.');
      }
    } catch (err: any) {
      const tErr = Date.now();
      console.error(`[Maya-Latency] ERROR at ${tErr - t0}ms:`, err.message || err);
      const backendMessage = err.response?.data?.detail;
      if (backendMessage) {
        resolvedOnError('backend', backendMessage);
      } else if (err.request) {
        resolvedOnError('network', 'Could not connect to Maya. Please check your internet connection.');
      } else {
        resolvedOnError('general', err.message || 'Something went wrong.');
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
