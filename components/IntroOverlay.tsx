import { useEffect, useRef, useCallback } from 'react';
import { View, Animated, StyleSheet, Easing, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useFonts, Poppins_700Bold, Poppins_500Medium } from '@expo-google-fonts/poppins';

const { width, height } = Dimensions.get('screen');

export default function IntroOverlay({ onFinish }: { onFinish: () => void }) {
  const [fontsLoaded] = useFonts({ Poppins_700Bold, Poppins_500Medium });

  const hasFinishedRef = useRef(false);
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const safeFinish = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    if (pulseLoopRef.current) {
      pulseLoopRef.current.stop();
    }
    onFinish();
  }, [onFinish]);

  // Priority Watchdog: Guarantee onFinish is called within 2800ms regardless of animation or device state
  useEffect(() => {
    const watchdogTimer = setTimeout(() => {
      safeFinish();
    }, 2800);

    return () => {
      clearTimeout(watchdogTimer);
    };
  }, [safeFinish]);

  const logoScale = useRef(new Animated.Value(0.65)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // Radiating glow animation refs (entrance + continuous loop)
  const glowEntranceScale = useRef(new Animated.Value(0.75)).current;
  const glowEntranceOpacity = useRef(new Animated.Value(0)).current;
  const glowPulseAnim = useRef(new Animated.Value(1)).current;

  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkY = useRef(new Animated.Value(14)).current;

  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY = useRef(new Animated.Value(10)).current;

  const footerOpacity = useRef(new Animated.Value(0)).current;
  const footerY = useRef(new Animated.Value(8)).current;

  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!fontsLoaded) return;

    // Continuous pulsating glow loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulseAnim, {
          toValue: 1.14,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulseAnim, {
          toValue: 0.96,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoopRef.current = pulseLoop;
    pulseLoop.start();

    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    // Entrance animation sequence
    const animSequence = Animated.sequence([
      // 1. Logo & Radiating Glow entrance (deterministic timing with overshoot easing, replacing unbounded springs)
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
        Animated.timing(glowEntranceOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(glowEntranceScale, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]),

      // 2. Wordmark entrance
      Animated.parallel([
        Animated.timing(wordmarkOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(wordmarkY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),

      // 3. Tagline entrance
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(taglineY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),

      // 4. Device icons entrance
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(footerOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(footerY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]);

    animSequence.start(() => {
      // Smooth fade out to main application
      fadeTimer = setTimeout(() => {
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          safeFinish();
        });
      }, 500);
    });

    return () => {
      if (fadeTimer) clearTimeout(fadeTimer);
      pulseLoop.stop();
      animSequence.stop();
    };
  }, [fontsLoaded, safeFinish]);

  if (!fontsLoaded) return <View style={styles.fallbackContainer} />;

  // Combined scale for radiating rings: entrance scale * continuous pulsating loop
  const combinedGlowScale = Animated.multiply(glowEntranceScale, glowPulseAnim);

  return (
    <Animated.View
      style={[styles.container, { opacity: containerOpacity }]}
      pointerEvents="auto"
    >
      {/* 1. Subtle Paper/Cream Warm Gradient Background */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="creamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFDF9" />
            <Stop offset="50%" stopColor="#FAF5ED" />
            <Stop offset="100%" stopColor="#F5ECE0" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#creamGrad)" />
      </Svg>

      {/* Main Content Area (Positioned comfortably above true center) */}
      <View style={styles.mainContent}>
        {/* 2. Logo Mark with Continuously Pulsing Radiating Warm Orange Glow Rings */}
        <View style={styles.logoWrapper}>
          {/* Outermost subtle radiance ring */}
          <Animated.View
            style={[
              styles.glowRingOuter,
              {
                opacity: glowEntranceOpacity,
                transform: [{ scale: combinedGlowScale }],
              },
            ]}
          />
          {/* Middle warmth radiance ring */}
          <Animated.View
            style={[
              styles.glowRingMiddle,
              {
                opacity: glowEntranceOpacity,
                transform: [{ scale: combinedGlowScale }],
              },
            ]}
          />
          {/* Innermost soft orange aura */}
          <Animated.View
            style={[
              styles.glowRingInner,
              {
                opacity: glowEntranceOpacity,
                transform: [{ scale: combinedGlowScale }],
              },
            ]}
          />

          {/* Actual Project Logo Asset */}
          <Animated.Image
            source={require('../assets/icon.png')}
            style={[
              styles.logoImage,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
            resizeMode="contain"
          />
        </View>

        {/* 3. Wordmark: UDYOG in bold uppercase (tightened gap and refined letterSpacing) */}
        <Animated.Text
          style={[
            styles.wordmark,
            {
              opacity: wordmarkOpacity,
              transform: [{ translateY: wordmarkY }],
            },
          ]}
        >
          UDYOG
        </Animated.Text>

        {/* 4. Tagline */}
        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: taglineOpacity,
              transform: [{ translateY: taglineY }],
            },
          ]}
        >
          India's Best Voice Billing App
        </Animated.Text>
      </View>

      {/* Bottom Section: Phone + Desktop Device Icons */}
      <View style={styles.bottomSection}>
        <Animated.View
          style={[
            styles.deviceIconRow,
            {
              opacity: footerOpacity,
              transform: [{ translateY: footerY }],
            },
          ]}
        >
          <Ionicons name="phone-portrait-outline" size={30} color="#64748B" />
          <View style={styles.deviceDivider} />
          <Ionicons name="desktop-outline" size={32} color="#64748B" />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FAF5ED',
    zIndex: 999,
    elevation: 999,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fallbackContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FAF5ED',
    zIndex: 999,
    elevation: 999,
  },

  // Main Center Section (Positioned comfortably above true center)
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingBottom: 20,
    marginTop: -20,
  },

  // Logo & Glow Stack (Tightened spacing between logo and wordmark)
  logoWrapper: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2, // Tightened from 8 to 2
  },
  glowRingOuter: {
    position: 'absolute',
    width: 204,
    height: 204,
    borderRadius: 102,
    backgroundColor: 'rgba(249, 115, 22, 0.05)',
  },
  glowRingMiddle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(249, 115, 22, 0.10)',
  },
  glowRingInner: {
    position: 'absolute',
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: 'rgba(251, 146, 60, 0.18)',
  },
  logoImage: {
    width: 98,
    height: 98,
    borderRadius: 24,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },

  // Typography (Tightened margin and letterSpacing)
  wordmark: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 36,
    color: '#0F172A',
    letterSpacing: 0.75, // Tightened from 2 to 0.75 for cohesive typography
    marginTop: 0, // Tightened from 6 to 0
    marginBottom: 4,
  },
  tagline: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: '#64748B',
    letterSpacing: 0.2,
  },

  // Bottom Section
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: '12%',
  },

  // Phone + Desktop Device Icons
  deviceIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  deviceDivider: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
  },
});
