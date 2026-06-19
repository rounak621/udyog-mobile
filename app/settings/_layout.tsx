import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

export default function SettingsLayout() {
  const router = useRouter();

  useEffect(() => {
    const onBackPress = () => {
      console.log('[BackHandler] settings hardwareBackPress fired');
      router.back();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
