import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Linking, Alert
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeScrollView } from '../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../constants/theme';
import { api, setAuthToken } from '../services/api';

export default function SubscriptionLockedScreen() {
  const { getToken, signOut } = useAuth();
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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const planName = (business?.subscription_plan || 'basic').toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Top Header without Back Button */}
      <View style={styles.topbar}>
        <Text style={styles.topbarTitle}>Account Locked</Text>
        <TouchableOpacity onPress={() => signOut()} style={styles.topbarLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.primary} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <SafeScrollView baseBottomPadding={40} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Expired Status Notice */}
        <View style={styles.statusCard}>
          <View style={styles.statusIconRow}>
            <Ionicons name="alert-circle" size={48} color={Colors.danger} />
          </View>
          <Text style={styles.statusTitle}>Subscription Expired</Text>
          <Text style={styles.statusSubtitle}>
            Your access to Udyog has been locked. Please upgrade or renew your plan below to continue.
          </Text>
          <View style={styles.divider} />
          <Text style={styles.statusPlan}>LAST PLAN: {planName}</Text>
        </View>

        <Text style={styles.sectionTitle}>Select a Plan to Reactivate</Text>

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

            <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={16} color={Colors.success} /><Text style={styles.planFeatureText}>1 CA Collaboration Access</Text></View>
            <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={16} color={Colors.success} /><Text style={styles.planFeatureText}>Maya AI Voice Billing</Text></View>
            <View style={styles.planFeatureRow}><Ionicons name="checkmark-circle" size={16} color={Colors.success} /><Text style={styles.planFeatureText}>Core GST Billing & Invoicing</Text></View>
          </View>
          <TouchableOpacity style={[styles.planBtn, styles.planBtnRecommended]} onPress={() => handleUpgrade('vistaar')}>
            <Text style={styles.planBtnTextRecommended}>Choose Vistaar</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>Payments are processed securely via Razorpay on the web app.</Text>
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  topbarTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  topbarLogout: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  logoutText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  statusCard: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: Radius.lg, padding: 24, alignItems: 'center' },
  statusIconRow: { marginBottom: 12 },
  statusTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  statusSubtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  divider: { height: 0.5, backgroundColor: '#fecaca', width: '100%', marginVertical: 14 },
  statusPlan: { fontSize: 12, fontWeight: '700', color: Colors.danger },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 12, marginBottom: 4 },
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
