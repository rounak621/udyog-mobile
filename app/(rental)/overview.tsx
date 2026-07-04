import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function RentalOverviewScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <Text style={styles.title}>Rental Overview</Text>
      </View>
      <View style={styles.body}>
        <Ionicons name="pie-chart-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.heading}>Coming soon</Text>
        <Text style={styles.sub}>Rental dashboard with revenue, active orders, and overdue alerts.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topbar: { backgroundColor: Colors.card, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  heading: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16 },
  sub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
