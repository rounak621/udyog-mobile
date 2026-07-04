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
  total_amount: number;
  payment_status: string;
  late_fee_total: number;
  items_count: number;
}

export default function RentalOrdersScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { business } = useBusiness();

  const [orders, setOrders] = useState<RentalOrderList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadOrders = useCallback(async () => {
    if (!business?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const token = await getToken();
      setAuthToken(token);
      const bId = business.id;

      const res = await api.get(`/rental-orders/?business_id=${bId}&status=ACTIVE`);
      setOrders(res.data);
    } catch (err) {
      console.log('Error loading rental orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [business?.id, getToken]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadOrders();
    }, [loadOrders])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const getDaysLeftOrOverdue = (endDateStr: string) => {
    if (!endDateStr) return { text: '', isOverdue: false };
    const [year, month, day] = endDateStr.split('-').map(Number);
    const end = new Date(year, month - 1, day);
    end.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return { text: `${diffDays} days left`, isOverdue: false };
    } else if (diffDays === 0) {
      return { text: 'Due today', isOverdue: false };
    } else {
      return { text: `${Math.abs(diffDays)} days overdue`, isOverdue: true };
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(
      (ord) =>
        ord.order_number.toLowerCase().includes(q) ||
        (ord.customer_name || '').toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

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
        <Text style={styles.title}>Active Rental Orders</Text>
        <TouchableOpacity
          onPress={() => router.push('/(rental)/order-create')}
          style={styles.headerIconBtn}
        >
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            placeholder="Search by order # or customer..."
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

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching orders found' : 'No active rental orders'}
            </Text>
          </View>
        ) : (
          filteredOrders.map((ord) => {
            const { text: durationText, isOverdue } = getDaysLeftOrOverdue(ord.end_date);
            const paymentStatus = ord.payment_status || 'UNPAID';

            return (
              <TouchableOpacity
                key={ord.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => Alert.alert('Coming Soon', 'Order Details will be available in Phase 6.')}
              >
                {/* Top Section */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderNumber}>Order {ord.order_number}</Text>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {ord.customer_name || 'Unknown Customer'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, isOverdue ? styles.badgeOverdue : styles.badgeActive]}>
                    <Text style={[styles.statusBadgeText, isOverdue ? styles.textOverdue : styles.textActive]}>
                      {isOverdue ? 'Overdue' : 'Active'}
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
                    <Text style={styles.infoLabel}>TIMELINE</Text>
                    <Text style={[styles.infoValue, isOverdue ? { color: Colors.danger, fontWeight: '700' } : {}]}>
                      {durationText}
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

                {/* Action Buttons */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => Alert.alert('Coming Soon', 'Record Return will be available in Phase 6.')}
                  >
                    <Ionicons name="enter-outline" size={15} color={Colors.primary} />
                    <Text style={styles.actionButtonText}>Return</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}
                    onPress={() => Alert.alert('Coming Soon', 'Waive Late Fee will be available in Phase 6.')}
                  >
                    <Ionicons name="cut-outline" size={15} color={Colors.primary} />
                    <Text style={styles.actionButtonText}>Waive Fee</Text>
                  </TouchableOpacity>
                </View>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  headerIconBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7ED' },

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
  badgeActive: { backgroundColor: '#EFF6FF' },
  badgeOverdue: { backgroundColor: '#FEF2F2' },
  statusBadgeText: { fontSize: 10, fontWeight: '600' },
  textActive: { color: '#2563EB' },
  textOverdue: { color: Colors.danger },

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

  cardActions: { flexDirection: 'row', backgroundColor: '#FFF', height: 40 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionButtonText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
});
