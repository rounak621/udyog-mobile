import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function IntroOverlay({ onFinish }: { onFinish: () => void }) {
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkY = useRef(new Animated.Value(12)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY = useRef(new Animated.Value(10)).current;
  const deviceOpacity = useRef(new Animated.Value(0)).current;
  const deviceY = useRef(new Animated.Value(10)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo arrives — spring scale + fade
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 140, friction: 9, useNativeDriver: true }),
      ]),
      // Wordmark rises
      Animated.parallel([
        Animated.timing(wordmarkOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(wordmarkY, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      // Tagline fades up
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(taglineY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      // Pause before the device row appears
      Animated.delay(200),
      // Device icon + "Mobile + Desktop" animate in together
      Animated.parallel([
        Animated.timing(deviceOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(deviceY, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(containerOpacity, { toValue: 0, duration: 280, useNativeDriver: true }).start(onFinish);
      }, 500);
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <Animated.Image
        source={require('../assets/icon.png')}
        style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
      />

      <Animated.Text style={[styles.wordmark, { opacity: wordmarkOpacity, transform: [{ translateY: wordmarkY }] }]}>
        Udyog
      </Animated.Text>

      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity, transform: [{ translateY: taglineY }] }]}>
        India's Best Voice Billing App
      </Animated.Text>

      <Animated.View style={[styles.deviceRow, { opacity: deviceOpacity, transform: [{ translateY: deviceY }] }]}>
        <View style={styles.deviceIconRow}>
          <Ionicons name="phone-portrait-outline" size={22} color="#0F172A" />
          <Ionicons name="desktop-outline" size={26} color="#0F172A" style={{ marginLeft: 6 }} />
        </View>
        <Text style={styles.deviceLabel}>MOBILE + DESKTOP</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logo: { width: 130, height: 130, marginBottom: 28 },
  wordmark: { fontSize: 28, fontWeight: '800', color: '#0F172A', letterSpacing: 0.5, marginBottom: 12 },
  tagline: { fontSize: 13, fontWeight: '500', color: '#64748B', marginBottom: 56 },
  deviceRow: { alignItems: 'center' },
  deviceIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  deviceLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 1.5 },
});
