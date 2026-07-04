import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

type AppMode = 'sales' | 'rental';

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  modeLoaded: boolean;
}

const STORAGE_KEY = 'app_mode';

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>('sales');
  const [modeLoaded, setModeLoaded] = useState(false);

  useEffect(() => {
    const loadMode = async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (stored === 'rental' || stored === 'sales') {
          setModeState(stored);
        }
      } catch {
        // Default stays 'sales'
      } finally {
        setModeLoaded(true);
      }
    };
    loadMode();
  }, []);

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
    SecureStore.setItemAsync(STORAGE_KEY, newMode).catch(() => {});
  }, []);

  return (
    <AppModeContext.Provider value={{ mode, setMode, modeLoaded }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (!context) throw new Error('useAppMode must be used within AppModeProvider');
  return context;
}
