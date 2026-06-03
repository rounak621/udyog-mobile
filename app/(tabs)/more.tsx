import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Switch
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius, Spacing } from '../../constants/theme';

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
      <View style={styles.topbar}>
        <Text style={styles.title}>More</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
            <Text style={styles.profileRole}>Business Owner</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Business */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business</Text>
          <View style={styles.card}>
            <MenuItem icon="business-outline" label="Business Settings" onPress={() => router.push('/settings/business')} />
            <MenuItem icon="people-outline" label="Manage Users" onPress={() => router.push('/settings/users')} />
            <MenuItem icon="document-text-outline" label="Invoice Settings" onPress={() => router.push('/settings/invoice')} />
          </View>
        </View>

        {/* Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Exports</Text>
          <View style={styles.card}>
            <MenuItem icon="download-outline" label="Export to Tally" onPress={() => router.push('/settings/exports')} />
            <MenuItem icon="stats-chart-outline" label="GST Reports" onPress={() => router.push('/reports')} />
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
            <MenuItem icon="help-circle-outline" label="Help & Support" onPress={() => {}} />
            <MenuItem icon="log-out-outline" label="Sign Out" onPress={handleLogout} danger />
          </View>
        </View>

        <Text style={styles.version}>Udyog v1.0.0 · Made in India 🇮🇳</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: '600', color: Colors.text },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, margin: 12, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  profileAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  profileEmail: { fontSize: 14, fontWeight: '600', color: Colors.text },
  profileRole: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  editBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
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
