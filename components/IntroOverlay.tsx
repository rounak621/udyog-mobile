import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useFonts, Poppins_700Bold, Poppins_600SemiBold, Poppins_500Medium } from '@expo-google-fonts/poppins';

const { width, height } = Dimensions.get('window');

export default function IntroOverlay({ onFinish }: { onFinish: () => void }) {
  const [fontsLoaded] = useFonts({ Poppins_700Bold, Poppins_600SemiBold, Poppins_500Medium });

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

  const mayaCardOpacity = useRef(new Animated.Value(0)).current;
  const mayaCardY = useRef(new Animated.Value(12)).current;

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
    pulseLoop.start();

    // Entrance animation sequence
    Animated.sequence([
      // 1. Logo & Radiating Glow entrance
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 130, friction: 8.5, useNativeDriver: true }),
        Animated.timing(glowEntranceOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.spring(glowEntranceScale, { toValue: 1, tension: 110, friction: 9, useNativeDriver: true }),
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

      // 4. Maya is listening card & device icons
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(mayaCardOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(mayaCardY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(footerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(footerY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Smooth fade out to main application
      setTimeout(() => {
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          pulseLoop.stop();
          onFinish();
        });
      }, 650);
    });

    return () => {
      pulseLoop.stop();
    };
  }, [fontsLoaded]);

  if (!fontsLoaded) return <View style={styles.fallbackContainer} />;

  // Combined scale for radiating rings: entrance scale * continuous pulsating loop
  const combinedGlowScale = Animated.multiply(glowEntranceScale, glowPulseAnim);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
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

      {/* Bottom Section: Maya Widget + Phone/Desktop Icons */}
      <View style={styles.bottomSection}>
        {/* 5. Premium "Maya is listening" Widget */}
        <Animated.View
          style={[
            styles.mayaCard,
            {
              opacity: mayaCardOpacity,
              transform: [{ translateY: mayaCardY }],
            },
          ]}
        >
          <View style={styles.mayaIconCircle}>
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.mayaTextWrap}>
            <View style={styles.mayaTitleRow}>
              <Text style={styles.mayaHeadline}>Maya is listening</Text>
              <View style={styles.liveDot} />
            </View>
            <Text style={styles.mayaSubtext}>Hinglish mein bolo, bill ban jayega</Text>
          </View>
        </Animated.View>

        {/* 6. Phone + Desktop Icon Pair */}
        <Animated.View
          style={[
            styles.deviceIconRow,
            {
              opacity: footerOpacity,
              transform: [{ translateY: footerY }],
            },
          ]}
        >
          <Ionicons name="phone-portrait-outline" size={16} color="#94A3B8" />
          <View style={styles.deviceDivider} />
          <Ionicons name="desktop-outline" size={17} color="#94A3B8" />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fallbackContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FAF5ED',
    zIndex: 999,
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
    paddingBottom: '10%',
  },

  // Premium Maya is Listening Card
  mayaCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.20)',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 20,
  },
  mayaIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  mayaTextWrap: {
    flex: 1,
  },
  mayaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mayaHeadline: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13.5,
    color: '#0F172A',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  mayaSubtext: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },

  // Phone + Desktop Device Icons
  deviceIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  deviceDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
});
