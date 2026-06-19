import { Stack, useRouter, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

export default function LegalLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const onBackPress = () => {
      console.log('[BackHandler] legal hardwareBackPress fired');
      console.log('[BackHandler] canGoBack:', router.canGoBack());
      router.back();
      setTimeout(() => {
        console.log('[BackHandler] pathname after back():', pathnameRef.current);
      }, 100);
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
