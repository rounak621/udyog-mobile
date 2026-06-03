import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Linking, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

export default function SubscriptionScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const res = await api.get('/businesses/me');
        setBusiness(res.data);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const isActive = business?.subscription_status === 'active' || business?.subscription_status === 'ACTIVE';
  const isTrial = business?.subscription_status === 'trial' || business?.subscription_status === 'TRIAL';

  const daysLeft = () => {
    const end = isActive ? business?.subscription_ends_at : business?.trial_ends_at;
    if (!end) return 0;
    return Math.max(0, Math.floor((new Date(end).getTime() - Date.now()) / 86400000));
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>My Plan</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={[styles.statusCard, isActive ? styles.statusActive : isTrial ? styles.statusTrial : styles.statusExpired]}>
          <View style={styles.statusIconRow}>
            <Ionicons name={isActive ? 'shield-checkmark' : isTrial ? 'time' : 'alert-circle'} size={32} color={isActive ? Colors.success : isTrial ? Colors.primary : Colors.danger} />
          </View>
          <Text style={styles.statusTitle}>
            {isActive ? 'Active Subscription' : isTrial ? 'Free Trial' : 'Subscription Expired'}
          </Text>
          <Text style={styles.statusPlan}>
            {(business?.subscription_plan || 'basic').toUpperCase()} PLAN
          </Text>
          {(isActive || isTrial) && (
            <Text style={styles.statusDays}>{daysLeft()} days remaining</Text>
          )}
        </View>

        {/* Plan Features */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What's included</Text>
          {[
            'Unlimited GST invoices',
            'Customer & supplier management',
            'GSTR-1, GSTR-3B reports',
            'Tally XML export',
            'PDF invoice sharing',
            'Maya AI voice billing',
            'Multi-device access',
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Pricing */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Basic Plan</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>₹149</Text>
            <Text style={styles.pricePer}>/month</Text>
          </View>
          <Text style={styles.priceNote}>₹1,499/year (save 2 months)</Text>
        </View>

        {!isActive && (
          <TouchableOpacity style={styles.upgradeBtn} onPress={() => Linking.openURL('https://app.udyogbook.in/subscribe')}>
            <Ionicons name="card-outline" size={18} color="#fff" />
            <Text style={styles.upgradeBtnText}>{isTrial ? 'Upgrade Now' : 'Renew Subscription'}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.note}>Payments are processed securely via Razorpay on the web app.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  statusCard: { borderRadius: Radius.lg, padding: 24, alignItems: 'center', borderWidth: 1 },
  statusActive: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  statusTrial: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  statusExpired: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  statusIconRow: { marginBottom: 12 },
  statusTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  statusPlan: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
  statusDays: { fontSize: 13, color: Colors.textSecondary },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  cardTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  featureText: { fontSize: 13, color: Colors.text },
  priceCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 20, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center' },
  priceLabel: { fontSize: 12, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  price: { fontSize: 36, fontWeight: '800', color: Colors.text, letterSpacing: -1 },
  pricePer: { fontSize: 16, color: Colors.textSecondary },
  priceNote: { fontSize: 12, color: Colors.success, marginTop: 6 },
  upgradeBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  upgradeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  note: { textAlign: 'center', fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
});
