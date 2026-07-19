import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import axios from 'axios';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
}

const MayaRecordingContext = createContext<MayaRecordingContextType | undefined>(undefined);

export function MayaRecordingProvider({ children }: { children: ReactNode }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMayaScreenActive, setMayaScreenActive] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

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
        Audio.RecordingOptionsPresets.HIGH_QUALITY
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

    // If stopRecording is called without upload parameters, it is a cancel/release action.
    if (!businessId || !history || !getToken || !onResponse || !onError) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      } catch (e) {
        console.error('Failed to stop recording on tab release', e);
      }
      return;
    }

    setIsProcessing(true);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        setIsProcessing(false);
        onError('empty', 'Recording was empty or could not be saved.');
        return;
      }

      const token = await getToken();

      const formData = new FormData();
      formData.append('business_id', businessId);
      formData.append('audio_format', 'audio/mp4');
      formData.append('conversation_history', JSON.stringify(history));

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

      const response = await axios.post('https://api.udyogbook.in/api/v1/ai/maya-command', formData, {
        headers,
        timeout: 60000,
      });

      if (response.data) {
        onResponse(response.data);
      } else {
        onError('backend', 'Backend returned empty response.');
      }
    } catch (err: any) {
      console.error('Stop recording/upload error', err);
      const backendMessage = err.response?.data?.detail;
      if (backendMessage) {
        onError('backend', backendMessage);
      } else if (err.request) {
        onError('network', 'Could not connect to Maya. Please check your internet connection.');
      } else {
        onError('general', err.message || 'Something went wrong.');
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
