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
import Svg, { Circle } from 'react-native-svg';

const PLANS = [
  {
    id: 'saral',
    name: 'Saral',
    tagline: 'Mobile Billing',
    price: '₹799',
    period: '/ year',
    platform: 'mobile' as const,
    features: [
      '2 Businesses Limit',
      'Maya AI Voice Billing',
      'Core GST Billing & Invoicing',
    ],
    excluded: ['No CA Access'],
  },
  {
    id: 'vistaar',
    name: 'Vistaar',
    tagline: 'Expansion Pack',
    price: '₹999',
    period: '/ year',
    platform: 'mobile' as const,
    recommended: true,
    features: [
      '6 Businesses Limit',
      '1 CA Collaboration Access',
      'Maya AI Voice Billing',
      'Core GST Billing & Invoicing',
    ],
    excluded: [],
  },
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Essential Billing',
    price: '₹1,788',
    period: '/ year',
    platform: 'web' as const,
    features: [
      'Unlimited Sales & Purchase Invoices',
      'Customer & Vendor Management',
      'Basic Stock Tracking',
    ],
    excluded: ['Maya Voice Agent', 'GST Reports', 'CA Sync Portal'],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Smart Business',
    price: '₹2,988',
    period: '/ year',
    platform: 'web' as const,
    features: [
      'All Basic features',
      'Maya AI Voice Billing',
      'AI Expense Tracking',
      'Staff Access (Limited)',
    ],
    excluded: ['GST Reports', 'CA Sync Portal'],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Complete Accounting',
    price: '₹3,588',
    period: '/ year',
    platform: 'both' as const,
    features: [
      'All Pro features',
      'One-Click GST Reports',
      'CA Collaboration Portal',
      'Profit & Loss Statements',
      'Advanced Staff Permissions',
    ],
    excluded: ['Rental Business'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Rental & Advanced',
    price: '₹5,988',
    period: '/ year',
    platform: 'both' as const,
    features: [
      'All Premium features',
      'Rental Equipment Scheduling',
      'Automated Late Fee Deductions',
      'Custom Branding on Invoices',
      'Priority Support',
    ],
    excluded: [],
  },
];

// Progress ring component for days remaining
function ProgressRing({ progress, size = 56, strokeWidth = 4, color = '#F97316' }: { progress: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.2)" strokeWidth={strokeWidth} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={`${circumference}`} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
        rotation="-90" origin={`${size / 2}, ${size / 2}`} />
    </Svg>
  );
}

export default function SubscriptionScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [business, setBusiness] = useState<any>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<'mobile' | 'desktop' | 'both'>('mobile');

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

  const totalDays = () => {
    if (isTrial) return 14;
    return 365;
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

  const days = daysLeft();
  const total = totalDays();
  const progress = total > 0 ? days / total : 0;
  const currentPlanId = (business?.subscription_plan || '').toLowerCase();
  const planName = (business?.subscription_plan || 'basic').toUpperCase();

  const filteredPlans = PLANS.filter(plan => {
    if (platformFilter === 'mobile') return plan.platform === 'mobile' || plan.platform === 'both';
    if (platformFilter === 'desktop') return plan.platform === 'web' || plan.platform === 'both';
    if (platformFilter === 'both') return plan.platform === 'both';
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>My Plan</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Gradient Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="shield-checkmark" size={22} color="#fff" />
                <Text style={styles.statusLabel}>
                  {isActive ? 'Active' : isCancelled ? 'Cancelled' : isTrial ? 'Free Trial' : 'Expired'}
                </Text>
              </View>
              <View style={styles.planPill}>
                <Text style={styles.planPillText}>{planName}</Text>
              </View>
            </View>
            {(isActive || isTrial || isCancelled) && (
              <View style={{ alignItems: 'center' }}>
                <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                  <ProgressRing progress={progress} size={56} strokeWidth={4} color="#fff" />
                  <View style={{ position: 'absolute', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{days}</Text>
                  </View>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 4, fontWeight: '600' }}>days left</Text>
              </View>
            )}
          </View>
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

        {/* Cancel Subscription */}
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

        {/* Billing History Timeline */}
        {billingHistory.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Billing History</Text>
            {billingHistory.map((payment: any, index: number) => (
              <View key={index} style={styles.timelineRow}>
                {/* Timeline dot and line */}
                <View style={styles.timelineDotCol}>
                  <View style={styles.timelineDot} />
                  {index < billingHistory.length - 1 && <View style={styles.timelineLine} />}
                </View>
                {/* Content */}
                <View style={styles.timelineContent}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={styles.historyPlan}>{(payment.plan || 'plan').toUpperCase()}</Text>
                        <View style={styles.paidBadge}>
                          <Text style={styles.paidBadgeText}>PAID</Text>
                        </View>
                      </View>
                      <Text style={styles.historyDate}>
                        {new Date(payment.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                      {payment.razorpay_payment_id ? (
                        <Text style={styles.historyPaymentId}>{payment.razorpay_payment_id}</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={styles.historyAmount}>
                        ₹{(payment.amount_inr ?? (payment.amount / 100)).toLocaleString('en-IN')}
                      </Text>
                      <TouchableOpacity hitSlop={8}>
                        <Ionicons name="download-outline" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 3-Way Platform Filter Segmented Control */}
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[styles.segmentedBtn, platformFilter === 'mobile' && styles.segmentedBtnActive]}
            onPress={() => setPlatformFilter('mobile')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={15}
              color={platformFilter === 'mobile' ? '#fff' : Colors.textSecondary}
            />
            <Text style={[styles.segmentedText, platformFilter === 'mobile' && styles.segmentedTextActive]}>
              Mobile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentedBtn, platformFilter === 'desktop' && styles.segmentedBtnActive]}
            onPress={() => setPlatformFilter('desktop')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="desktop-outline"
              size={15}
              color={platformFilter === 'desktop' ? '#fff' : Colors.textSecondary}
            />
            <Text style={[styles.segmentedText, platformFilter === 'desktop' && styles.segmentedTextActive]}>
              Desktop
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentedBtn, platformFilter === 'both' && styles.segmentedBtnActive]}
            onPress={() => setPlatformFilter('both')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="layers-outline"
              size={15}
              color={platformFilter === 'both' ? '#fff' : Colors.textSecondary}
            />
            <Text style={[styles.segmentedText, platformFilter === 'both' && styles.segmentedTextActive]}>
              Mobile + Desktop
            </Text>
          </TouchableOpacity>
        </View>

        {/* Plan Cards */}
        <View style={{ gap: 12, marginTop: 4 }}>
          {filteredPlans.map(plan => {
            const isCurrent = isActive && plan.id === currentPlanId;
            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  plan.recommended && !isCurrent && styles.planCardRecommended,
                  isCurrent && styles.planCardCurrent,
                ]}
              >
                {isCurrent ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>✓ CURRENT PLAN</Text>
                  </View>
                ) : plan.recommended ? (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedBadgeText}>RECOMMENDED</Text>
                  </View>
                ) : null}

                {/* Platform badge */}
                <View
                  style={
                    plan.platform === 'mobile'
                      ? styles.mobileBadge
                      : plan.platform === 'web'
                      ? styles.webBadge
                      : styles.bothBadge
                  }
                >
                  <Text
                    style={
                      plan.platform === 'mobile'
                        ? styles.mobileBadgeText
                        : plan.platform === 'web'
                        ? styles.webBadgeText
                        : styles.bothBadgeText
                    }
                  >
                    {plan.platform === 'mobile'
                      ? 'Mobile Only'
                      : plan.platform === 'web'
                      ? 'Web Only'
                      : 'Mobile + Web'}
                  </Text>
                </View>

                <View style={styles.planHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planTagline}>{plan.tagline}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.planPrice}>{plan.price}</Text>
                    <Text style={styles.planPriceSub}>{plan.period}</Text>
                  </View>
                </View>

                <View style={styles.planDivider} />

                <View style={styles.planFeatures}>
                  {plan.features.map((f, i) => (
                    <View key={i} style={styles.planFeatureRow}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={styles.planFeatureText}>{f}</Text>
                    </View>
                  ))}
                  {plan.excluded.map((f, i) => (
                    <View key={`ex-${i}`} style={styles.planFeatureRow}>
                      <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                      <Text style={[styles.planFeatureText, { color: Colors.textMuted }]}>{f}</Text>
                    </View>
                  ))}
                </View>

                {isCurrent ? (
                  <TouchableOpacity style={styles.planBtnCurrent} disabled={true}>
                    <Text style={styles.planBtnTextCurrent}>✓ Current Plan</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.planBtn, plan.recommended && styles.planBtnRecommended]}
                    onPress={() => handleUpgrade(plan.id)}
                  >
                    <Text style={plan.recommended ? styles.planBtnTextRecommended : styles.planBtnText}>
                      {isActive ? `Upgrade to ${plan.name}` : `Choose ${plan.name}`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <Text style={styles.note}>Payments are processed securely via Razorpay on the web app.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { padding: 12, gap: 12, paddingBottom: 40 },

  // Status card with gradient
  statusCard: { borderRadius: Radius.lg, padding: 20, backgroundColor: '#F97316', overflow: 'hidden' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  planPill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100, alignSelf: 'flex-start', marginTop: 4 },
  planPillText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  // Cards
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  cardTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 14 },

  // Segmented control styles
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 100,
    padding: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
    marginBottom: 4,
  },
  segmentedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 100,
    gap: 4,
  },
  segmentedBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentedText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  segmentedTextActive: {
    color: '#fff',
  },

  // Plan cards
  planCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 20, borderWidth: 0.5, borderColor: Colors.border, position: 'relative' },
  planCardRecommended: { borderColor: Colors.primary, borderWidth: 1.5, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  planCardCurrent: { borderColor: '#16a34a', borderWidth: 2 },
  recommendedBadge: { position: 'absolute', top: -10, right: 20, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 2, borderRadius: Radius.sm },
  recommendedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  currentBadge: { position: 'absolute', top: -10, right: 20, backgroundColor: '#16a34a', paddingHorizontal: 10, paddingVertical: 2, borderRadius: Radius.sm },
  currentBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
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
  planBtnCurrent: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: Radius.sm, padding: 12, alignItems: 'center' },
  planBtnTextCurrent: { color: '#16a34a', fontSize: 14, fontWeight: '700' },

  // Platform badges
  mobileBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, borderWidth: 1, borderColor: '#bae6fd' },
  mobileBadgeText: { color: '#0369a1', fontSize: 10, fontWeight: '700' },
  webBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, borderWidth: 1, borderColor: '#cbd5e1' },
  webBadgeText: { color: '#475569', fontSize: 10, fontWeight: '700' },
  bothBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, borderWidth: 1, borderColor: '#fed7aa' },
  bothBadgeText: { color: '#c2410c', fontSize: 10, fontWeight: '700' },

  // Billing timeline
  timelineRow: { flexDirection: 'row', marginBottom: 0 },
  timelineDotCol: { width: 20, alignItems: 'center', paddingTop: 6 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  timelineLine: { width: 1.5, flex: 1, backgroundColor: Colors.border, marginTop: 4 },
  timelineContent: { flex: 1, paddingLeft: 10, paddingBottom: 16 },
  paidBadge: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 100 },
  paidBadgeText: { color: '#16a34a', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  historyPlan: { fontSize: 13, fontWeight: '700', color: Colors.text },
  historyDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  historyPaymentId: { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  historyAmount: { fontSize: 14, fontWeight: '700', color: Colors.text },

  // Cancel button
  cancelBtn: { backgroundColor: '#f8fafc', borderBottomWidth: 1, borderColor: '#e2e8f0', borderWidth: 1, borderRadius: Radius.sm, padding: 12, alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  cancelledBanner: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: Radius.md, padding: 14, gap: 10 },
  cancelledBannerText: { fontSize: 13, color: '#991b1b', lineHeight: 18 },
  resubscribeBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
  resubscribeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  note: { textAlign: 'center', fontSize: 12, color: Colors.textMuted, lineHeight: 18, marginTop: 8 },
});
