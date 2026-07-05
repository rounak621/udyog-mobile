import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts, Poppins_700Bold, Poppins_600SemiBold, Poppins_500Medium } from '@expo-google-fonts/poppins';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

export default function IntroOverlay({ onFinish }: { onFinish: () => void }) {
  const [fontsLoaded] = useFonts({ Poppins_700Bold, Poppins_600SemiBold, Poppins_500Medium });

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
    if (!fontsLoaded) return;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 140, friction: 9, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(wordmarkOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(wordmarkY, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(taglineY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(deviceOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(deviceY, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(containerOpacity, { toValue: 0, duration: 280, useNativeDriver: true }).start(onFinish);
      }, 550);
    });
  }, [fontsLoaded]);

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <View style={styles.centeredSection}>
        <View style={styles.glowWrap}>
          <Svg width={280} height={280} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#F97316" stopOpacity="0.35" />
                <Stop offset="100%" stopColor="#F97316" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="140" cy="140" r="140" fill="url(#glow)" />
          </Svg>
          <Animated.Image
            source={require('../assets/icon.png')}
            style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
            resizeMode="contain"
          />
        </View>
        <Animated.Text style={[styles.wordmark, { opacity: wordmarkOpacity, transform: [{ translateY: wordmarkY }] }]}>
          Udyog
        </Animated.Text>
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity, transform: [{ translateY: taglineY }] }]}>
          India's Best Voice Billing App
        </Animated.Text>
      </View>

      <Animated.View style={[styles.deviceRow, { opacity: deviceOpacity, transform: [{ translateY: deviceY }] }]}>
        <View style={styles.deviceIconRow}>
          <Ionicons name="phone-portrait-outline" size={44} color="#0F172A" />
          <Ionicons name="desktop-outline" size={52} color="#0F172A" style={{ marginLeft: 14 }} />
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
    zIndex: 999,
  },
  centeredSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  glowWrap: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo: { width: 130, height: 130 },
  wordmark: { fontFamily: 'Poppins_700Bold', fontSize: 40, color: '#0F172A', letterSpacing: 0.3, marginBottom: 10 },
  tagline: { fontFamily: 'Poppins_500Medium', fontSize: 15, color: '#64748B', letterSpacing: 0.2 },
  deviceRow: { alignItems: 'center', paddingBottom: '14%' },
  deviceIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  deviceLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#94A3B8', letterSpacing: 2 },
});
