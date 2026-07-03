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

  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: isRecording ? 1.15 : 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isRecording]);

  const handlePress = (e: any) => {
    // If not currently on the Maya tab, behave as a normal tap (navigates to Maya tab)
    if (!isMayaScreenActive) {
      if (props.onPress) {
        props.onPress(e);
      }
    }
  };

  return (
    <TouchableOpacity
      {...props}
      activeOpacity={0.8}
      onPress={handlePress}
      onPressIn={() => {
        if (isMayaScreenActive) {
          startRecording();
        }
      }}
      onPressOut={() => {
        if (isMayaScreenActive) {
          stopRecording();
        }
      }}
      style={[props.style, styles.tabButtonContainer]}
    >
      <Animated.View style={[
        styles.fab,
        isMayaScreenActive && styles.fabActive,
        isRecording && styles.fabRecording,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        <Ionicons name="mic-outline" size={24} color="#fff" />
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
  fab: {
    width: 52, height: 52, borderRadius: 26,
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
