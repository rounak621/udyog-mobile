import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SystemBars } from 'react-native-edge-to-edge';
import * as SecureStore from 'expo-secure-store';
import { Slot, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import IntroOverlay from '../components/IntroOverlay';

WebBrowser.maybeCompleteAuthSession();
import { Colors } from '../constants/theme';
import { setAuthToken, api } from '../services/api';
import Constants from 'expo-constants';
import { registerForPushNotificationsAsync, registerDeviceToken } from '../services/notifications';
import { BusinessProvider, useBusiness } from '../context/BusinessContext';
import { AppModeProvider, useAppMode } from '../context/AppModeContext';

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
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();
  const [tokenReady, setTokenReady] = useState(false);
  const { mode, modeLoaded } = useAppMode();
  const [pushRegistered, setPushRegistered] = useState(false);

  const [roleSetupDone, setRoleSetupDone] = useState(false);
  const [businessCheckDone, setBusinessCheckDone] = useState(false);
  const { hasBusiness, setHasBusiness, refreshBusinesses, business } = useBusiness();
  const [checkingBusiness, setCheckingBusiness] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      setBusinessCheckDone(false);
      setHasBusiness(false);
      setRoleSetupDone(false);
    }
  }, [isSignedIn]);

  // Silent role setup in background (only once per user session)
  useEffect(() => {
    if (isSignedIn && user && !roleSetupDone) {
      const existingRole = user.publicMetadata?.role;
      if (existingRole === 'user' || existingRole === 'owner' || existingRole === 'ca' || existingRole === 'admin') {
        setRoleSetupDone(true);
        return;
      }
      
      const setupRole = async () => {
        try {
          const token = await getToken();
          setAuthToken(token);
          await api.put('/users/me/role', { role: 'USER' });
          setRoleSetupDone(true);
          await user.reload();
        } catch (err) {
          console.log('Silent role setup failed:', err);
        }
      };
      setupRole();
    }
  }, [isSignedIn, user, roleSetupDone]);

  // Check if business exists on backend
  useEffect(() => {
    if (isSignedIn && tokenReady && !businessCheckDone && !checkingBusiness) {
      setCheckingBusiness(true);
      const checkBusiness = async () => {
        try {
          await refreshBusinesses();
        } catch (err) {
          console.log('Error checking business in AuthGuard:', err);
        } finally {
          setBusinessCheckDone(true);
          setCheckingBusiness(false);
        }
      };
      checkBusiness();
    }
  }, [isSignedIn, tokenReady, businessCheckDone, checkingBusiness, refreshBusinesses]);

  useEffect(() => {
    if (isSignedIn && tokenReady && hasBusiness && !pushRegistered) {
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
  }, [isSignedIn, tokenReady, hasBusiness, pushRegistered]);

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
    if (!isLoaded || !tokenReady || !modeLoaded) return;
    if (isSignedIn && !businessCheckDone) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inWelcome = segments[0] === 'welcome';
    const inOnboarding = segments[0] === 'onboarding';
    const inLegal = segments[0] === 'legal';
    const inBusinessSetup = segments[0] === 'business-setup';
    const inSubscriptionLocked = segments[0] === 'subscription-locked';

    if (!isSignedIn && !inAuthGroup && !inWelcome && !inLegal) {
      router.replace('/welcome');
    } else if (isSignedIn) {
      const isExpired = business?.subscription_status?.toLowerCase() === 'expired';

      if (isExpired) {
        if (!inSubscriptionLocked && !inLegal) {
          router.replace('/subscription-locked');
        }
      } else if (hasBusiness) {
        if (inAuthGroup || inWelcome || inOnboarding || inBusinessSetup || inSubscriptionLocked) {
          if (mode === 'rental') {
            router.replace('/(rental)/overview');
          } else {
            router.replace('/(tabs)');
          }
        }
      } else {
        if (!inBusinessSetup && !inLegal) {
          router.replace('/business-setup');
        }
      }
    }
  }, [isLoaded, isSignedIn, segments, tokenReady, businessCheckDone, hasBusiness, business, mode, modeLoaded]);

  if (!isLoaded || !modeLoaded || (isSignedIn && !businessCheckDone)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
        <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [showIntro, setShowIntro] = useState(true);
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
  return (
    <SafeAreaProvider>
      <SystemBars style="dark" />
      <AppModeProvider>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <BusinessProvider>
            <AuthGuard />
          </BusinessProvider>
        </ClerkProvider>
        {showIntro && <IntroOverlay onFinish={() => setShowIntro(false)} />}
      </AppModeProvider>
    </SafeAreaProvider>
  );
}
