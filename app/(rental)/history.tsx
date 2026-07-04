import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, RefreshControl, ActivityIndicator, Alert
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { useBusiness } from '../../context/BusinessContext';

interface RentalOrderList {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  start_date: string;
  end_date: string;
  actual_return_date: string | null;
  total_amount: number;
  payment_status: string;
  late_fee_total: number;
  items_count: number;
}

export default function RentalHistoryScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { business } = useBusiness();

  const [orders, setOrders] = useState<RentalOrderList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');

  const loadHistory = useCallback(async () => {
    if (!business?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const token = await getToken();
      setAuthToken(token);
      const bId = business.id;

      const [completedRes, cancelledRes] = await Promise.all([
        api.get(`/rental-orders/?business_id=${bId}&status=COMPLETED`),
        api.get(`/rental-orders/?business_id=${bId}&status=CANCELLED`)
      ]);

      const merged = [...completedRes.data, ...cancelledRes.data];

      const getDateVal = (ord: RentalOrderList) => {
        if (ord.actual_return_date) return new Date(ord.actual_return_date).getTime();
        if (ord.end_date) return new Date(ord.end_date).getTime();
        return 0;
      };

      const sorted = merged.sort((a, b) => getDateVal(b) - getDateVal(a));
      setOrders(sorted);
    } catch (err) {
      console.log('Error loading rental history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [business?.id, getToken]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadHistory();
    }, [loadHistory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const handleMarkPaid = async (orderId: string) => {
    if (!business?.id) return;
    try {
      const token = await getToken();
      setAuthToken(token);
      
      await api.post(`/rental-orders/${orderId}/mark-paid?business_id=${business.id}`, {
        payment_method: 'CASH'
      });

      Alert.alert('Success', 'Order marked as fully paid.');
      loadHistory();
    } catch (err) {
      console.log('Failed to mark order as paid:', err);
      Alert.alert('Error', 'Failed to mark order as paid. Please try again.');
    }
  };

  const confirmMarkPaid = (orderId: string, orderNumber: string) => {
    Alert.alert(
      'Mark Paid',
      `Are you sure you want to mark Order ${orderNumber} as fully paid via CASH?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark Paid', onPress: () => handleMarkPaid(orderId) }
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const getTimelineText = (ord: RentalOrderList) => {
    if (ord.status === 'CANCELLED') {
      return 'Cancelled';
    }
    if (ord.actual_return_date) {
      return `Returned ${formatDate(ord.actual_return_date)}`;
    }
    return 'Completed';
  };

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (filter === 'COMPLETED') result = result.filter(o => o.status === 'COMPLETED');
    if (filter === 'CANCELLED') result = result.filter(o => o.status === 'CANCELLED');
    const q = searchQuery.toLowerCase().trim();
    if (!q) return result;
    return result.filter(
      (ord) =>
        ord.order_number.toLowerCase().includes(q) ||
        (ord.customer_name || '').toLowerCase().includes(q)
    );
  }, [orders, searchQuery, filter]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Rental History</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            placeholder="Search history..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholderTextColor={Colors.textMuted}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['ALL', 'COMPLETED', 'CANCELLED'] as const).map((f) => {
          const isActive = filter === f;
          const label = f === 'ALL' ? 'All' : f === 'COMPLETED' ? 'Returned' : 'Cancelled';
          const icon = f === 'COMPLETED' ? 'checkmark-circle' : f === 'CANCELLED' ? 'close-circle' : null;
          const activeBg = f === 'ALL' ? Colors.primary : f === 'COMPLETED' ? Colors.success : Colors.textSecondary;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, isActive && { backgroundColor: activeBg }]}
              onPress={() => setFilter(f)}
            >
              {icon && isActive && <Ionicons name={icon} size={14} color="#fff" />}
              <Text style={[styles.filterPillText, isActive && { color: '#fff' }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="time-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching history records' : 'No history records found'}
            </Text>
          </View>
        ) : (
          filteredOrders.map((ord) => {
            const paymentStatus = ord.payment_status || 'UNPAID';
            const isCompleted = ord.status === 'COMPLETED';
            const isCancelled = ord.status === 'CANCELLED';

            return (
              <TouchableOpacity
                key={ord.id}
                style={[styles.card, { borderLeftWidth: 4, borderLeftColor: isCompleted ? Colors.success : Colors.textSecondary }]}
                activeOpacity={0.8}
                onPress={() => router.push(`/rental-order/${ord.id}`)}
              >
                {/* Top Section */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderNumber}>Order {ord.order_number}</Text>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {ord.customer_name || 'Unknown Customer'}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    isCompleted ? styles.badgeCompleted : styles.badgeCancelled
                  ]}>
                    <Text style={[
                      styles.statusBadgeText,
                      isCompleted ? styles.textCompleted : styles.textCancelled
                    ]}>
                      {ord.status}
                    </Text>
                  </View>
                </View>

                {/* Info Fields */}
                <View style={styles.infoRow}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>ITEMS</Text>
                    <Text style={styles.infoValue}>
                      {ord.items_count} item{ord.items_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>DURATION</Text>
                    <Text style={styles.infoValue}>
                      {formatDate(ord.start_date)} ➔ {formatDate(ord.end_date)}
                    </Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>{isCompleted ? 'RETURNED' : 'TIMELINE'}</Text>
                    <Text style={[styles.infoValue, isCancelled ? { color: Colors.textSecondary } : { color: Colors.success, fontWeight: '600' }]}>
                      {getTimelineText(ord)}
                    </Text>
                  </View>
                </View>

                {/* Amount Row */}
                <View style={styles.amountRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Text style={styles.amountLabel}>Total Due:</Text>
                    <Text style={styles.amountValue}>
                      ₹{Number(ord.total_amount).toLocaleString('en-IN')}
                    </Text>
                    {Number(ord.late_fee_total) > 0 && (
                      <Text style={styles.lateFeeText}>
                        (+ ₹{Number(ord.late_fee_total).toLocaleString('en-IN')} late fee)
                      </Text>
                    )}
                  </View>
                  <View style={[
                    styles.payBadge,
                    paymentStatus === 'PAID' ? styles.payPaid : paymentStatus === 'PARTIAL' ? styles.payPartial : styles.payUnpaid
                  ]}>
                    <Text style={[
                      styles.payBadgeText,
                      paymentStatus === 'PAID' ? styles.payTextPaid : paymentStatus === 'PARTIAL' ? styles.payTextPartial : styles.payTextUnpaid
                    ]}>
                      {paymentStatus}
                    </Text>
                  </View>
                </View>

                {/* Mark Paid Quick Action */}
                {isCompleted && paymentStatus !== 'PAID' && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => confirmMarkPaid(ord.id, ord.order_number)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
                      <Text style={styles.actionButtonText}>Mark Paid</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },

  searchContainer: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.card, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 10, height: 38 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text, padding: 0 },

  emptyCard: { backgroundColor: Colors.card, borderRadius: 12, padding: 32, alignItems: 'center', margin: 16, borderWidth: 0.5, borderColor: Colors.border },
  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 8 },

  card: { backgroundColor: Colors.card, borderRadius: 12, marginHorizontal: 16, marginTop: 12, borderWidth: 0.5, borderColor: Colors.border, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  orderNumber: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  customerName: { fontSize: 14, fontWeight: '600', color: Colors.text, marginTop: 2 },

  statusBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeCompleted: { backgroundColor: '#F0FDF4' },
  badgeCancelled: { backgroundColor: '#F1F5F9' },
  statusBadgeText: { fontSize: 10, fontWeight: '600' },
  textCompleted: { color: '#16A34A' },
  textCancelled: { color: '#64748B' },

  infoRow: { flexDirection: 'row', padding: 14, backgroundColor: '#FAFBFD', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 12, fontWeight: '500', color: Colors.text },

  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  amountLabel: { fontSize: 12, color: Colors.textSecondary },
  amountValue: { fontSize: 15, fontWeight: '700', color: Colors.text },
  lateFeeText: { fontSize: 10, color: Colors.danger, fontWeight: '500' },

  payBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  payPaid: { backgroundColor: '#F0FDF4' },
  payUnpaid: { backgroundColor: '#FFF7ED' },
  payPartial: { backgroundColor: '#EFF6FF' },
  payBadgeText: { fontSize: 9, fontWeight: '600' },
  payTextPaid: { color: '#16A34A' },
  payTextUnpaid: { color: '#C2410C' },
  payTextPartial: { color: '#2563EB' },

  cardActions: { flexDirection: 'row', backgroundColor: '#FDFDFD', height: 40, borderTopWidth: 0.5, borderTopColor: Colors.border },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionButtonText: { fontSize: 12, fontWeight: '600', color: '#16A34A' },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filterPill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterPillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
});
