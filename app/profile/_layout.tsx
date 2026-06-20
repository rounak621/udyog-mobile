import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

export default function ProfileLayout() {
  const router = useRouter();

  useEffect(() => {
    const onBackPress = () => {
      router.back();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
