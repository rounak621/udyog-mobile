import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeScrollView } from '../../components/ui/SafeLayout';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { useAppMode } from '../../context/AppModeContext';

const MenuItem = ({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
      <Ionicons name={icon} size={18} color={danger ? Colors.danger : Colors.primary} />
    </View>
    <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
  </TouchableOpacity>
);

export default function RentalMoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setMode } = useAppMode();

  const switchToSales = () => {
    setMode('sales');
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <Text style={styles.title}>More</Text>
      </View>

      <SafeScrollView baseBottomPadding={20} showsVerticalScrollIndicator={false}>
        {/* Switch Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mode</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.switchRow} onPress={switchToSales}>
              <View style={styles.switchIcon}>
                <Ionicons name="storefront-outline" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Switch to Sales Business</Text>
                <Text style={styles.switchSub}>Go back to invoicing, bills, and inventory</Text>
              </View>
              <Ionicons name="swap-horizontal" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Rental Screens */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rental</Text>
          <View style={styles.card}>
            <MenuItem icon="alert-circle-outline" label="Overdue Orders" onPress={() => router.push('/(rental)/overdue')} />
            <MenuItem icon="time-outline" label="Rental History" onPress={() => router.push('/(rental)/history')} />
          </View>
        </View>
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  section: { paddingHorizontal: 12, marginTop: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginLeft: 4 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  menuIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  menuIconDanger: { backgroundColor: '#fef2f2' },
  menuLabel: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
  menuLabelDanger: { color: Colors.danger },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  switchIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  switchLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  switchSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
