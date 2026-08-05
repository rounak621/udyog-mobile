import { Slot, usePathname, useRouter } from 'expo-router';
import { View, StyleSheet, TouchableOpacity, Text, BackHandler } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Colors } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReportsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const onBack = () => {
      router.replace('/(tabs)/more');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [router]);

  const tabs = [
    { route: '/reports/sales', icon: 'trending-up', label: 'Sales' },
    { route: '/reports/purchase', icon: 'trending-down', label: 'Purchase' },
    { route: '/reports/profit-loss', icon: 'calculator', label: 'P&L' },
    { route: '/reports/day-book', icon: 'book', label: 'Day Book' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      <View style={[styles.tabbar, { height: 60 + insets.bottom, paddingBottom: 8 + insets.bottom }]}>
        {tabs.map(t => {
          const isActive = pathname === t.route;
          return (
            <TouchableOpacity
              key={t.route}
              style={styles.tab}
              onPress={() => router.push(t.route as any)}
            >
              <Ionicons
                name={isActive ? (t.icon as any) : (`${t.icon}-outline` as any)}
                size={18}
                color={isActive ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabbar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    paddingTop: 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 3,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
