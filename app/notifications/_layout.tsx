import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { safeBack } from '../../utils/navigation';

export default function NotificationsLayout() {
  const router = useRouter();

  useEffect(() => {
    const onBackPress = () => {
      safeBack(router, '/(tabs)');
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
