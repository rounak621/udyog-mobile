import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Switch, Modal, ActivityIndicator
} from 'react-native';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeScrollView } from '../../components/ui/SafeLayout';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { useBusiness } from '../../context/BusinessContext';
import { useAppMode } from '../../context/AppModeContext';
import BusinessSwitcherModal from '../../components/BusinessSwitcherModal';

const MenuItem = ({ icon, label, value, onPress, danger, rightElement }: any) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
      <Ionicons name={icon} size={18} color={danger ? Colors.danger : Colors.primary} />
    </View>
    <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
    {value ? <Text style={styles.menuValue}>{value}</Text> : null}
    {rightElement || <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
  </TouchableOpacity>
);

export default function MoreScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { business } = useBusiness();
  const { setMode } = useAppMode();

  const [showSwitcher, setShowSwitcher] = useState(false);

  const switchToRental = () => {
    setMode('rental');
    router.replace('/(rental)/overview');
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/welcome');
        }
      }
    ]);
  };

  const email = user?.emailAddresses?.[0]?.emailAddress || '';
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>More</Text>
      </View>

      <SafeScrollView baseBottomPadding={20} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
            <Text style={styles.profileRole}>Business Owner</Text>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/profile')}>
            <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Active Business Switcher Card */}
        {business && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Business</Text>
            <TouchableOpacity 
              style={styles.businessSwitcherCard} 
              onPress={() => setShowSwitcher(true)}
            >
              <View style={styles.businessIconContainer}>
                <Ionicons name="business" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.businessName} numberOfLines={1}>{business.name}</Text>
                <Text style={styles.businessGst}>
                  {business.gst_enabled ? `GSTIN: ${business.gst_number}` : 'GST: Unregistered'}
                </Text>
              </View>
              <Ionicons name="swap-horizontal" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Business */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business</Text>
          <View style={styles.card}>
            <MenuItem icon="calendar-outline" label="Switch to Rental Business" onPress={switchToRental} />
            <MenuItem icon="business-outline" label="Business Settings" onPress={() => router.push('/settings/business')} />
            <MenuItem icon="document-text-outline" label="Invoice Settings" onPress={() => router.push('/settings/invoice')} />
            <MenuItem icon="cube-outline" label="Items" onPress={() => router.push('/items')} />
            <MenuItem icon="layers-outline" label="Inventory" onPress={() => router.push('/inventory')} />
            <MenuItem icon="receipt-outline" label="Purchase Bills" onPress={() => router.push('/purchase-bills')} />
            <MenuItem icon="bar-chart-outline" label="Reports" onPress={() => router.push('/reports')} />
            <MenuItem icon="people-outline" label="Manage CA" onPress={() => router.push('/settings/ca-management')} />
          </View>
        </View>

        {/* Subscription */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.card}>
            <MenuItem icon="card-outline" label="My Plan" onPress={() => router.push('/settings/subscription')} />
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <MenuItem icon="help-circle-outline" label="Help & Support" onPress={() => router.push('/help')} />
            <MenuItem icon="log-out-outline" label="Sign Out" onPress={handleLogout} danger />
          </View>
        </View>

        <Text style={styles.version}>Udyog v1.0.0 · Made in India 🇮🇳</Text>
      </SafeScrollView>

      {/* Business Switcher Modal */}
      <BusinessSwitcherModal
        visible={showSwitcher}
        onClose={() => setShowSwitcher(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, margin: 12, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  profileAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  profileEmail: { fontSize: 14, fontWeight: '600', color: Colors.text },
  profileRole: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  editBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  
  businessSwitcherCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, marginHorizontal: 4, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: Colors.border, marginBottom: 12 },
  businessIconContainer: { width: 38, height: 38, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  businessName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  businessGst: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  section: { paddingHorizontal: 12, marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginLeft: 4 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  menuIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  menuIconDanger: { backgroundColor: '#fef2f2' },
  menuLabel: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
  menuLabelDanger: { color: Colors.danger },
  menuValue: { fontSize: 12, color: Colors.textSecondary, marginRight: 4 },
  version: { textAlign: 'center', fontSize: 12, color: Colors.textMuted, padding: 24 },
});
