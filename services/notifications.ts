import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

let isHandlerSet = false;

async function ensureNotificationHandler() {
  if (isHandlerSet) return;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    isHandlerSet = true;
  } catch (err) {
    console.log('Error setting notification handler dynamically:', err);
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Constants.appOwnership === 'expo') {
    console.log('Push notifications skipped — not supported in Expo Go, will work in production build');
    return null;
  }

  try {
    await ensureNotificationHandler();
    const Notifications = await import('expo-notifications');

    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    // Set default notification channel on Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token: permission not granted');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.log('Failed to get project ID from Expo config');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (error) {
    console.log('Error registering for push notifications:', error);
    return null;
  }
}

export async function registerDeviceToken(businessId: string, token: string) {
  try {
    const res = await api.post('/device-tokens', {
      business_id: businessId,
      expo_push_token: token,
    });
    console.log('Device token registered with backend successfully:', res.data);
    return res.data;
  } catch (error) {
    console.log('Error registering device token with backend:', error);
    throw error;
  }
}

export function normalizeDeepLink(link?: string | null): string | null {
  if (!link) return null;
  let target = String(link).trim();
  if (!target) return null;

  // Handle plural /invoices/:id -> /invoice/:id (singular)
  if (target.startsWith('/invoices/')) {
    target = target.replace('/invoices/', '/invoice/');
  } else if (target.startsWith('invoices/')) {
    target = target.replace('invoices/', '/invoice/');
  }

  // Ensure leading slash if relative
  if (!target.startsWith('/') && !target.startsWith('http')) {
    target = '/' + target;
  }

  return target;
}

