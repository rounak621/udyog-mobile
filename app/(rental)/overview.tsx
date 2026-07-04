import { useAuth, useUser } from '@clerk/clerk-expo';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, ActivityIndicator, Alert
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { useBusiness } from '../../context/BusinessContext';
import BusinessSwitcherModal from '../../components/BusinessSwitcherModal';

interface AnalyticsData {
  total_revenue: number;
  pending_payments: number;
  security_held: number;
  late_fees_earned: number;
  active_orders: number;
  overdue_orders: number;
  items_out: number;
}

interface AssetSummaryData {
  total: number;
  available: number;
  on_rent: number;
  overdue: number;
  maintenance: number;
  lost: number;
}

interface RentalOrderList {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  end_date: string;
  total_amount: number;
  payment_status: string;
  late_fee_total: number;
}

export default function RentalOverviewScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { business } = useBusiness();

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [assetSummary, setAssetSummary] = useState<AssetSummaryData | null>(null);
  const [activeOrders, setActiveOrders] = useState<RentalOrderList[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);

  const formatIndianStyle = (n: number) => {
    if (!n) return '₹0';
    const abs = Math.abs(n);
    const isNegative = n < 0;
    let formatted = '';
    if (abs >= 10000000) {
      formatted = (abs / 10000000).toFixed(2) + 'Cr';
    } else if (abs >= 100000) {
      formatted = (abs / 100000).toFixed(2) + 'L';
    } else if (abs >= 1000) {
      formatted = (abs / 1000).toFixed(1) + 'K';
    } else {
      formatted = abs.toString();
    }
    formatted = formatted.replace(/\.0+([A-Za-z]+)$/, '$1');
    formatted = formatted.replace(/(\.[0-9])0+([A-Za-z]+)$/, '$1$2');
    return (isNegative ? '-₹' : '₹') + formatted;
  };

  const getDaysLeftOrOverdue = (endDateStr: string) => {
    if (!endDateStr) return '';
    const [year, month, day] = endDateStr.split('-').map(Number);
    const end = new Date(year, month - 1, day);
    end.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return `Due in ${diffDays}d`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else {
      return `${Math.abs(diffDays)}d overdue`;
    }
  };

  const loadData = useCallback(async () => {
    if (!business?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const token = await getToken();
      setAuthToken(token);
      const bId = business.id;

      const [analyticsRes, assetRes, ordersRes] = await Promise.allSettled([
        api.get(`/rental-orders/analytics?business_id=${bId}`),
        api.get(`/rental-assets/summary?business_id=${bId}`),
        api.get(`/rental-orders/?business_id=${bId}&status=ACTIVE&limit=5`)
      ]);

      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value.data);
      }
      if (assetRes.status === 'fulfilled') {
        setAssetSummary(assetRes.value.data);
      }
      if (ordersRes.status === 'fulfilled') {
        setActiveOrders(ordersRes.value.data);
      }
    } catch (err) {
      console.log('Error loading rental overview data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [business?.id, getToken]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const avatarInitials = (business?.name || 'U')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => setShowSwitcher(true)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.bizName}>{business?.name || 'My Business'}</Text>
            <Ionicons name="chevron-down" size={16} color="#0F172A" />
          </View>
          <Text style={styles.bizSub}>Rental Mode · {business?.state || ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{avatarInitials}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* Quick Actions Row */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => Alert.alert('Coming Soon', 'New Rental Order feature is coming in Phase 6.')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="add" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>New Order</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(rental)/assets')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="hardware-chip-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Manage Assets</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(rental)/overdue')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>View Overdue</Text>
          </TouchableOpacity>
        </View>

        {/* Financial Stat Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financials</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Revenue</Text>
              <Text style={[styles.statValue, { color: Colors.primary }]} numberOfLines={1}>
                {formatIndianStyle(analytics?.total_revenue || 0)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Pending Payments</Text>
              <Text style={[styles.statValue, { color: Colors.danger }]} numberOfLines={1}>
                {formatIndianStyle(analytics?.pending_payments || 0)}
              </Text>
            </View>
          </View>
          <View style={[styles.statsRow, { marginTop: 10 }]}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Security Held</Text>
              <Text style={[styles.statValue, { color: Colors.success }]} numberOfLines={1}>
                {formatIndianStyle(analytics?.security_held || 0)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Late Fees Earned</Text>
              <Text style={[styles.statValue, { color: Colors.warning }]} numberOfLines={1}>
                {formatIndianStyle(analytics?.late_fees_earned || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Operational Stat Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operations</Text>
          <View style={styles.operationsGrid}>
            <View style={styles.opCard}>
              <Text style={styles.opLabel}>Active Orders</Text>
              <Text style={styles.opValue}>{analytics?.active_orders || 0}</Text>
            </View>
            <View style={styles.opCard}>
              <Text style={styles.opLabel}>Overdue Orders</Text>
              <Text style={styles.opValue}>{analytics?.overdue_orders || 0}</Text>
            </View>
            <View style={styles.opCard}>
              <Text style={styles.opLabel}>Items Out</Text>
              <Text style={styles.opValue}>{analytics?.items_out || 0}</Text>
            </View>
            <TouchableOpacity
              style={styles.opCard}
              onPress={() => router.push('/(rental)/assets')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Text style={styles.opLabel}>In Maintenance</Text>
                <Ionicons name="chevron-forward" size={12} color={Colors.textMuted} />
              </View>
              <Text style={styles.opValue}>{assetSummary?.maintenance || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Top 5 Active Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Active Orders</Text>
            <TouchableOpacity onPress={() => router.push('/(rental)/orders')}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>

          {activeOrders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No active rental orders</Text>
            </View>
          ) : (
            activeOrders.map((ord) => {
              const daysText = getDaysLeftOrOverdue(ord.end_date);
              const isOverdue = daysText.includes('overdue');
              const paymentStatus = ord.payment_status || 'UNPAID';

              return (
                <TouchableOpacity
                  key={ord.id}
                  style={styles.orderCard}
                  onPress={() => Alert.alert('Coming Soon', 'Order Details will be available in Phase 6.')}
                >
                  <View style={styles.orderIcon}>
                    <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
                  </View>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderName} numberOfLines={1}>{ord.customer_name || 'Unknown Customer'}</Text>
                    <Text style={styles.orderSub}>Order {ord.order_number}</Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.orderAmount}>₹{Number(ord.total_amount).toLocaleString('en-IN')}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }}>
                      <Text style={[styles.dueText, isOverdue ? styles.dueOverdue : styles.dueActive]}>
                        {daysText}
                      </Text>
                      <View style={[
                        styles.badge,
                        paymentStatus === 'PAID' ? styles.badgePaid : paymentStatus === 'PARTIAL' ? styles.badgePartial : styles.badgeUnpaid
                      ]}>
                        <Text style={[
                          styles.badgeText,
                          paymentStatus === 'PAID' ? styles.badgeTextPaid : paymentStatus === 'PARTIAL' ? styles.badgeTextPartial : styles.badgeTextUnpaid
                        ]}>
                          {paymentStatus}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Business Switcher Modal */}
      <BusinessSwitcherModal
        visible={showSwitcher}
        onClose={() => setShowSwitcher(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: Colors.card, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  bizName: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  bizSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  quickActionsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 16, marginBottom: 20 },
  quickAction: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  quickActionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickActionLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },

  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  viewAll: { fontSize: 13, color: Colors.primary },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 14, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 6 },
  statValue: { fontSize: 17, fontWeight: '700' },

  operationsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  opCard: { width: '47%', flexGrow: 1, minWidth: 150, backgroundColor: Colors.card, borderRadius: 12, padding: 14, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  opLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 6 },
  opValue: { fontSize: 20, fontWeight: '700', color: Colors.text },

  emptyCard: { backgroundColor: Colors.card, borderRadius: 12, padding: 32, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border },
  emptyText: { fontSize: 14, color: Colors.textSecondary, marginTop: 8 },

  orderCard: { backgroundColor: Colors.card, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  orderIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  orderInfo: { flex: 1, minWidth: 0 },
  orderName: { fontSize: 13, fontWeight: '500', color: Colors.text },
  orderSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  orderRight: { alignItems: 'flex-end' },
  orderAmount: { fontSize: 13, fontWeight: '600', color: Colors.text },

  dueText: { fontSize: 10, fontWeight: '600' },
  dueActive: { color: Colors.textSecondary },
  dueOverdue: { color: Colors.danger },

  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgePaid: { backgroundColor: '#F0FDF4' },
  badgeUnpaid: { backgroundColor: '#FFF7ED' },
  badgePartial: { backgroundColor: '#EFF6FF' },
  badgeText: { fontSize: 9, fontWeight: '600' },
  badgeTextPaid: { color: '#16A34A' },
  badgeTextUnpaid: { color: '#C2410C' },
  badgeTextPartial: { color: '#2563EB' },
});
