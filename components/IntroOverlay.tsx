import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const SIZE = 140;
const RADIUS = 52;
const STROKE = 14;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const NAVY_ARC_LENGTH = CIRCUMFERENCE * 0.75; // 270° ring, 90° gap for orange

// Orange quarter-wedge path (top-right quadrant, 12 -> 3 o'clock)
const orangeWedgePath = `M ${CENTER} ${CENTER} L ${CENTER} ${CENTER - RADIUS + STROKE / 2} A ${RADIUS - STROKE / 2} ${RADIUS - STROKE / 2} 0 0 1 ${CENTER + RADIUS - STROKE / 2} ${CENTER} Z`;

export default function IntroOverlay({ onFinish }: { onFinish: () => void }) {
  const glowScale = useRef(new Animated.Value(0.3)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const ghostOpacity = useRef(new Animated.Value(0)).current;
  const navyDash = useRef(new Animated.Value(NAVY_ARC_LENGTH)).current;
  const orangeScale = useRef(new Animated.Value(0.5)).current;
  const orangeOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkY = useRef(new Animated.Value(10)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Glow blooms + ghost ring fades in/out, navy ring traces in
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale, { toValue: 1.35, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(glowScale, { toValue: 1.05, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.timing(glowOpacity, { toValue: 0.28, duration: 1400, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(ghostOpacity, { toValue: 0.15, duration: 300, useNativeDriver: true }),
          Animated.timing(ghostOpacity, { toValue: 0, duration: 480, useNativeDriver: true }),
        ]),
        Animated.timing(navyDash, {
          toValue: 0,
          duration: 660,
          delay: 60,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: false, // strokeDashoffset isn't supported by native driver
        }),
      ]),
      // Orange wedge snaps in with spring
      Animated.parallel([
        Animated.spring(orangeScale, { toValue: 1, tension: 180, friction: 8, useNativeDriver: true }),
        Animated.timing(orangeOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      // Wordmark rises
      Animated.parallel([
        Animated.timing(wordmarkOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(wordmarkY, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      // Accent line sweeps in
      Animated.timing(lineWidth, { toValue: 44, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(containerOpacity, { toValue: 0, duration: 280, useNativeDriver: true }).start(onFinish);
      }, 400);
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <View style={styles.logoWrap}>
        {/* Radial glow */}
        <Animated.View
          style={[
            styles.glow,
            { opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]}
        >
          <Svg width={SIZE * 1.8} height={SIZE * 1.8} viewBox={`0 0 ${SIZE * 1.8} ${SIZE * 1.8}`}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#F97316" stopOpacity="0.9" />
                <Stop offset="100%" stopColor="#F97316" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={SIZE * 0.9} cy={SIZE * 0.9} r={SIZE * 0.9} fill="url(#glow)" />
          </Svg>
        </Animated.View>

        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Ghost ring (full faint circle, tracing feel) */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke="#1A1D26"
            strokeWidth={STROKE}
            fill="none"
            opacity={ghostOpacity as any}
          />
          {/* Navy ring — 270°, animated draw-in via strokeDashoffset */}
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke="#1A1D26"
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${NAVY_ARC_LENGTH}, ${CIRCUMFERENCE}`}
            strokeDashoffset={navyDash}
            strokeLinecap="butt"
            rotation="-180"
            origin={`${CENTER}, ${CENTER}`}
          />
          {/* Orange quarter wedge */}
          <AnimatedPath
            d={orangeWedgePath}
            fill="#F97316"
            opacity={orangeOpacity}
            scale={orangeScale as any}
            origin={`${CENTER}, ${CENTER}`}
          />
        </Svg>
      </View>

      <Animated.Text style={[styles.wordmark, { opacity: wordmarkOpacity, transform: [{ translateY: wordmarkY }] }]}>
        Udyog
      </Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity: wordmarkOpacity }]}>
        MOBILE + DESKTOP
      </Animated.Text>
      <Animated.View style={[styles.accentLine, { width: lineWidth }]} />
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
  logoWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  glow: { position: 'absolute' },
  wordmark: { fontSize: 26, fontWeight: '800', color: '#0F172A', letterSpacing: 0.5 },
  tagline: { fontSize: 11, fontWeight: '600', color: '#64748B', letterSpacing: 2, marginTop: 4 },
  accentLine: { height: 3, backgroundColor: '#F97316', borderRadius: 2, marginTop: 10 },
});
