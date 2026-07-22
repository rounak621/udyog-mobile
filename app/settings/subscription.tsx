import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Linking, Alert, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

export default function SubscriptionScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [business, setBusiness] = useState<any>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);

  const loadData = async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await api.get('/businesses/me');
      const biz = res.data;
      setBusiness(biz);
      if (biz?.id) {
        try {
          const histRes = await api.get(`/subscriptions/billing-history?business_id=${biz.id}`);
          setBillingHistory(histRes.data || []);
        } catch {
          setBillingHistory([]);
        }
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const isActive = business?.subscription_status === 'active' || business?.subscription_status === 'ACTIVE';
  const isTrial = business?.subscription_status === 'trial' || business?.subscription_status === 'TRIAL';
  const isCancelled = business?.subscription_status === 'cancelled' || business?.subscription_status === 'CANCELLED';

  const daysLeft = () => {
    const end = (isActive || isCancelled) ? business?.subscription_ends_at : business?.trial_ends_at;
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

  const handleCancelSubscription = () => {
    if (!business?.id) return;

    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription?\n\nYour access will continue until the end of your current billing period. No refunds are provided.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Plan',
          style: 'destructive',
          onPress: async () => {
            setCancelLoading(true);
            try {
              const token = await getToken();
              setAuthToken(token);
              await api.post('/subscriptions/cancel', { business_id: business.id });
              Alert.alert(
                'Success',
                'Subscription cancelled. You can continue using Udyog until your billing period ends.'
              );
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.detail || 'Failed to cancel subscription');
            } finally {
              setCancelLoading(false);
            }
          },
        },
      ]
    );
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
        <View style={[styles.statusCard, isActive ? styles.statusActive : isCancelled ? styles.statusCancelled : isTrial ? styles.statusTrial : styles.statusExpired]}>
          <View style={styles.statusIconRow}>
            <Ionicons name={isActive ? 'shield-checkmark' : isCancelled ? 'remove-circle-outline' : isTrial ? 'time' : 'alert-circle'} size={32} color={isActive ? Colors.success : isCancelled ? Colors.danger : isTrial ? Colors.primary : Colors.danger} />
          </View>
          <Text style={styles.statusTitle}>
            {isActive ? 'Active Subscription' : isCancelled ? 'Subscription Cancelled' : isTrial ? 'Free Trial' : 'Subscription Expired'}
          </Text>
          <Text style={styles.statusPlan}>
            {(business?.subscription_plan || 'basic').toUpperCase()} PLAN
          </Text>
          {(isActive || isTrial || isCancelled) && (
            <Text style={styles.statusDays}>{daysLeft()} days remaining</Text>
          )}
        </View>

        {/* Cancelled Banner */}
        {isCancelled && (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledBannerText}>
              Subscription cancelled. Access continues until{' '}
              {business?.subscription_ends_at
                ? new Date(business.subscription_ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}.
            </Text>
            <TouchableOpacity style={styles.resubscribeBtn} onPress={() => handleUpgrade(business?.subscription_plan || 'vistaar')}>
              <Text style={styles.resubscribeBtnText}>Resubscribe →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Cancel Subscription Action Button */}
        {isActive && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancelSubscription}
            disabled={cancelLoading}
          >
            {cancelLoading ? (
              <ActivityIndicator color={Colors.textSecondary} size="small" />
            ) : (
              <Text style={styles.cancelBtnText}>Cancel Subscription</Text>
            )}
          </TouchableOpacity>
        )}

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

        {/* Billing History Card */}
        {billingHistory.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Billing History</Text>
            {billingHistory.map((payment: any, index: number) => (
              <View key={index} style={[styles.historyRow, index < billingHistory.length - 1 && styles.historyRowBorder]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Text style={styles.historyPlan}>{(payment.plan || 'plan').toUpperCase()}</Text>
                    <View style={styles.historyBadge}>
                      <Text style={styles.historyBadgeText}>{payment.status || 'captured'}</Text>
                    </View>
                  </View>
                  <Text style={styles.historyDate}>
                    {new Date(payment.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                  {payment.razorpay_payment_id ? (
                    <Text style={styles.historyPaymentId}>{payment.razorpay_payment_id}</Text>
                  ) : null}
                </View>
                <Text style={styles.historyAmount}>
                  ₹{(payment.amount_inr ?? (payment.amount / 100)).toLocaleString('en-IN')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {!isActive && !isCancelled && (
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
  statusCancelled: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
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

  cancelBtn: { backgroundColor: '#f8fafc', borderBottomWidth: 1, borderColor: '#e2e8f0', borderWidth: 1, borderRadius: Radius.sm, padding: 12, alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  cancelledBanner: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: Radius.md, padding: 14, gap: 10 },
  cancelledBannerText: { fontSize: 13, color: '#991b1b', lineHeight: 18 },
  resubscribeBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
  resubscribeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  historyRowBorder: { borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  historyPlan: { fontSize: 13, fontWeight: '700', color: Colors.text },
  historyBadge: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 100 },
  historyBadgeText: { color: '#16a34a', fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  historyDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  historyPaymentId: { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  historyAmount: { fontSize: 14, fontWeight: '700', color: Colors.text }
});
