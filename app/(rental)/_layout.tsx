import { Tabs } from 'expo-router';
import { Colors } from '../../constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabBarIcon({ name, color, size }: { name: any; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function RentalTabsLayout() {
  const insets = useSafeAreaInsets();

  return (
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
        name="overview"
        options={{
          title: 'Overview',
          tabBarIcon: ({ color, size }) => <TabBarIcon name="pie-chart-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <TabBarIcon name="receipt-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size }) => <TabBarIcon name="cube-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="assets"
        options={{
          title: 'Assets',
          tabBarIcon: ({ color, size }) => <TabBarIcon name="hardware-chip-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <TabBarIcon name="ellipsis-horizontal-outline" color={color} size={size} />,
        }}
      />
      {/* Hidden screens — navigated to from More, not shown in tab bar */}
      <Tabs.Screen name="overdue" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="product-create" options={{ href: null }} />
      <Tabs.Screen name="product-bulk-add" options={{ href: null }} />
      <Tabs.Screen name="asset-list" options={{ href: null }} />
      <Tabs.Screen name="asset-bulk-add" options={{ href: null }} />
      <Tabs.Screen name="order-create" options={{ href: null }} />
    </Tabs>
  );
}
