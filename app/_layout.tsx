import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '../constants/theme';
import { setAuthToken, api } from '../services/api';
import Constants from 'expo-constants';
import { registerForPushNotificationsAsync, registerDeviceToken } from '../services/notifications';

const tokenCache = {
  async getToken(key: string) {
    try { return await SecureStore.getItemAsync(key); } catch { return null; }
  },
  async saveToken(key: string, value: string) {
    try { await SecureStore.setItemAsync(key, value); } catch {}
  },
  async clearToken(key: string) {
    try { await SecureStore.deleteItemAsync(key); } catch {}
  },
};

function AuthGuard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [tokenReady, setTokenReady] = useState(false);
  const [pushRegistered, setPushRegistered] = useState(false);

  useEffect(() => {
    if (isSignedIn && tokenReady && !pushRegistered) {
      setPushRegistered(true);
      const setupPush = async () => {
        try {
          if (Constants.appOwnership === 'expo') {
            console.log('Push notifications skipped in app layout — running in Expo Go');
            return;
          }
          const bizRes = await api.get('/businesses/me');
          const businessId = bizRes.data?.id;
          if (businessId) {
            try {
              const token = await registerForPushNotificationsAsync();
              if (token) {
                await registerDeviceToken(businessId, token);
              }
            } catch (notifErr) {
              console.log('Push registration failed inside layout:', notifErr);
            }
          }
        } catch (error) {
          console.log('Push setup failed:', error);
        }
      };
      setupPush();
    }
  }, [isSignedIn, tokenReady, pushRegistered]);

  useEffect(() => {
    if (isSignedIn) {
      getToken().then(token => {
        setAuthToken(token);
        setTokenReady(true);
      });
    } else {
      setAuthToken(null);
      setTokenReady(true);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !tokenReady) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inWelcome = segments[0] === 'welcome';
    const inOnboarding = segments[0] === 'onboarding';
    const inLegal = segments[0] === 'legal';

    if (!isSignedIn && !inAuthGroup && !inWelcome && !inLegal) {
      router.replace('/welcome');
    } else if (isSignedIn && (inAuthGroup || inWelcome)) {
      router.replace('/(tabs)');
    }
  }, [isLoaded, isSignedIn, segments, tokenReady]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
        <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthGuard />
    </ClerkProvider>
  );
}
