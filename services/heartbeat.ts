import { AppState, AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';
import { getOrCreateDeviceId } from '../utils/deviceId';

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export async function sendHeartbeat(): Promise<void> {
  try {
    const deviceId = await getOrCreateDeviceId();
    const appVersion = Constants.expoConfig?.version || '1.0.0';
    await api.post('/devices/heartbeat', {
      device_id: deviceId,
      app_version: appVersion,
    });
  } catch (err) {
    // Silent fail for network dropouts
    console.log('[HEARTBEAT] Ping failed:', err);
  }
}

export function startHeartbeatService(isAuthenticated: boolean): () => void {
  if (!isAuthenticated) {
    stopHeartbeatService();
    return () => {};
  }

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      sendHeartbeat();
      if (!heartbeatInterval) {
        heartbeatInterval = setInterval(() => {
          sendHeartbeat();
        }, 35000); // 35s tick
      }
    } else {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }
  };

  // Immediate trigger if currently active
  if (AppState.currentState === 'active') {
    sendHeartbeat();
    if (!heartbeatInterval) {
      heartbeatInterval = setInterval(() => {
        sendHeartbeat();
      }, 35000);
    }
  }

  const appStateSub = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    appStateSub.remove();
    stopHeartbeatService();
  };
}

export function stopHeartbeatService(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}
