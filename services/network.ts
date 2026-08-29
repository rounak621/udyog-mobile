import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

/**
 * Subscribes to network connectivity changes.
 * Calls callback with `true` when online, `false` when offline.
 */
export function subscribeToNetworkStatus(callback: (isOnline: boolean) => void): () => void {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const isOnline = state.isConnected !== false && state.isInternetReachable !== false;
    callback(isOnline);
  });
  return unsubscribe;
}

/**
 * One-off check whether device currently has network connectivity.
 */
export async function checkIsOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch {
    // If NetInfo fetch fails, default to true to prevent false offline lockouts
    return true;
  }
}
