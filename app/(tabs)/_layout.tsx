import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Colors } from '../../constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MayaRecordingProvider, useMayaRecording } from '../../context/MayaRecordingContext';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabBarIcon({ name, color, size }: { name: any; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function MayaTabBarButton(props: any) {
  const { isRecording, isMayaScreenActive, startRecording, stopRecording } = useMayaRecording();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const tailBufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One-shot scale bump when recording starts/stops
  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: isRecording ? 1.1 : 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isRecording]);

  // Continuous breathing pulse loop while recording
  useEffect(() => {
    if (isRecording) {
      // Start glow ring fade-in
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Start breathing loop
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulseLoop.current = loop;
      loop.start();
    } else {
      // Stop breathing
      if (pulseLoop.current) {
        pulseLoop.current.stop();
        pulseLoop.current = null;
      }
      // Reset pulse scale
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      // Fade out glow ring
      Animated.timing(glowOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isRecording]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (tailBufferTimerRef.current) {
        clearTimeout(tailBufferTimerRef.current);
      }
    };
  }, []);

  const handlePress = () => {
    // Overridden to do nothing to prevent immediate/duplicate navigation on touch start/release.
    // Navigation is deferred to onPressOut.
  };

  return (
    <TouchableOpacity
      {...props}
      activeOpacity={0.8}
      onPress={handlePress}
      onPressIn={(e) => {
        // Cancel any pending tail-buffer stop from a previous press
        if (tailBufferTimerRef.current) {
          clearTimeout(tailBufferTimerRef.current);
          tailBufferTimerRef.current = null;
        }
        startRecording();
        if (!isMayaScreenActive && props.onPress) {
          requestAnimationFrame(() => {
            props.onPress(e);
          });
        }
      }}
      onPressOut={(e) => {
        // Delay the actual stopRecording by 400ms to capture the audio
        // tail buffer (last syllable). Visual state change (animation reset)
        // happens instantly via isRecording going false inside the context.
        tailBufferTimerRef.current = setTimeout(() => {
          stopRecording();
          tailBufferTimerRef.current = null;
        }, 400);
      }}
      style={[props.style, styles.tabButtonContainer]}
    >
      {/* Outer glow ring — pulsing opacity behind the FAB while recording */}
      <Animated.View style={[
        styles.glowRing,
        {
          opacity: glowOpacity,
          transform: [{ scale: pulseAnim }],
        },
      ]} />

      {/* Main FAB button */}
      <Animated.View style={[
        styles.fab,
        isMayaScreenActive && styles.fabActive,
        isRecording && styles.fabRecording,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={24} color="#fff" />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <MayaRecordingProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarStyle: {
            backgroundColor: Colors.card,
            borderTopWidth: 0.5,
            borderTopColor: Colors.border,
            height: 60 + insets.bottom,
            paddingBottom: Math.max(8, insets.bottom),
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <TabBarIcon name="home-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="bills"
          options={{
            title: 'Bills',
            tabBarIcon: ({ color, size }) => <TabBarIcon name="document-text-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="maya"
          options={{
            title: 'Maya',
            tabBarButton: (props) => <MayaTabBarButton {...props} />,
          }}
        />
        <Tabs.Screen
          name="parties"
          options={{
            title: 'Parties',
            tabBarIcon: ({ color, size }) => <TabBarIcon name="people-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color, size }) => <TabBarIcon name="ellipsis-horizontal-outline" color={color} size={size} />,
          }}
        />
      </Tabs>
    </MayaRecordingProvider>
  );
}

const styles = StyleSheet.create({
  tabButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    height: '100%',
  },
  glowRing: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    marginBottom: 16,
  },
  fab: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabActive: { backgroundColor: '#EA580C' },
  fabRecording: { backgroundColor: Colors.danger },
});
