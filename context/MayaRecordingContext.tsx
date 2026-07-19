import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MayaRecordingContextType {
  isRecording: boolean;
  isMayaScreenActive: boolean;
  setMayaScreenActive: (active: boolean) => void;
  startRecording: () => void;
  stopRecording: () => void;
}

const MayaRecordingContext = createContext<MayaRecordingContextType | undefined>(undefined);

export function MayaRecordingProvider({ children }: { children: ReactNode }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isMayaScreenActive, setMayaScreenActive] = useState(false);

  const startRecording = () => {
    setIsRecording(true);
  };

  const stopRecording = () => {
    setIsRecording(false);
    // TODO: implement actual Audio.Recording capture and send to /ai/maya-chat
  };

  return (
    <MayaRecordingContext.Provider
      value={{
        isRecording,
        isMayaScreenActive,
        setMayaScreenActive,
        startRecording,
        stopRecording,
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
