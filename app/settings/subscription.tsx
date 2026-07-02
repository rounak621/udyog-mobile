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

  const handleUpgrade = async (planId: string) => {
    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await api.post('/subscriptions/handover-token');
      const redirectTarget = encodeURIComponent(`https://app.udyogbook.in/subscribe?plan=${planId}`);
      const finalUrl = `${res.data.url}&redirect_url=${redirectTarget}`;
      await Linking.openURL(finalUrl);
    } catch (err: any) {
      Alert.alert('Error', 'Could not open subscription page. Please try again.');
    }
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

        {!isActive && (
          <View style={{ gap: 16, marginTop: 12 }}>
            <Text style={styles.sectionTitle}>Upgrade or Renew</Text>

            {/* Saral Card */}
            <View style={styles.planCard}>
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planName}>Saral</Text>
                  <Text style={styles.planTagline}>Mobile Billing</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.planPrice}>₹799</Text>
                  <Text style={styles.planPriceSub}>/ year</Text>
                </View>
              </View>
              <View style={styles.planDivider} />
              <View style={styles.planFeatures}>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={16} color={Colors.success} /><Text style={styles.planFeatureText}>2 Businesses Limit</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={16} color={Colors.success} /><Text style={styles.planFeatureText}>30 E-Way Bills / Month</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={16} color={Colors.success} /><Text style={styles.planFeatureText}>Maya AI Voice Billing</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={16} color={Colors.success} /><Text style={styles.planFeatureText}>Core GST Billing & Invoicing</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="close-circle" size={16} color={Colors.textMuted} /><Text style={[styles.planFeatureText, { color: Colors.textMuted }]}>No CA Access</Text></View>
              </View>
              <TouchableOpacity style={styles.planBtn} onPress={() => handleUpgrade('saral')}>
                <Text style={styles.planBtnText}>Choose Saral</Text>
              </TouchableOpacity>
            </View>

            {/* Vistaar Card (Recommended) */}
            <View style={[styles.planCard, styles.planCardRecommended]}>
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedBadgeText}>RECOMMENDED</Text>
              </View>
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planName}>Vistaar</Text>
                  <Text style={styles.planTagline}>Expansion Pack</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.planPrice}>₹999</Text>
                  <Text style={styles.planPriceSub}>/ year</Text>
                </View>
              </View>
              <View style={styles.planDivider} />
              <View style={styles.planFeatures}>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={16} color={Colors.success} /><Text style={styles.planFeatureText}>6 Businesses Limit</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={16} color={Colors.success} /><Text style={styles.planFeatureText}>75 E-Way Bills / Month</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={16} color={Colors.success} /><Text style={styles.planFeatureText}>1 CA Collaboration Access</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={16} color={Colors.success} /><Text style={styles.planFeatureText}>Maya AI Voice Billing</Text></View>
                <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={16} color={Colors.success} /><Text style={styles.planFeatureText}>Core GST Billing & Invoicing</Text></View>
              </View>
              <TouchableOpacity style={[styles.planBtn, styles.planBtnRecommended]} onPress={() => handleUpgrade('vistaar')}>
                <Text style={styles.planBtnTextRecommended}>Choose Vistaar</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 12, marginBottom: 4 },
  planCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 20, borderWidth: 0.5, borderColor: Colors.border, position: 'relative' },
  planCardRecommended: { borderColor: Colors.primary, borderWidth: 1.5, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  recommendedBadge: { position: 'absolute', top: -10, right: 20, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 2, borderRadius: Radius.sm },
  recommendedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { fontSize: 18, fontWeight: '700', color: Colors.text },
  planTagline: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  planPrice: { fontSize: 24, fontWeight: '800', color: Colors.text },
  planPriceSub: { fontSize: 12, color: Colors.textSecondary },
  planDivider: { height: 0.5, backgroundColor: Colors.border, marginVertical: 16 },
  planFeatures: { gap: 10, marginBottom: 20 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planFeatureText: { fontSize: 13, color: Colors.text },
  planBtn: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: 12, alignItems: 'center' },
  planBtnRecommended: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  planBtnText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  planBtnTextRecommended: { color: '#fff', fontSize: 14, fontWeight: '700' },
  note: { textAlign: 'center', fontSize: 12, color: Colors.textMuted, lineHeight: 18, marginTop: 8 },
});
