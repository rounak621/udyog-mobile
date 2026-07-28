import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, RefreshControl,
  ActivityIndicator, FlatList
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

interface PurchaseBill {
  id: string;
  supplier_invoice_number: string;
  supplier: {
    id: string;
    name: string;
    gstin?: string | null;
  };
  total_amount: number;
  payment_status: string;
  bill_date: string;
}

export default function PurchaseBillsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [businessId, setBusinessId] = useState<string>('');
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 50;

  const loadBills = async (currentSkip = 0, isRefreshing = false) => {
    if (currentSkip === 0) {
      if (!isRefreshing) setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const token = await getToken();
      setAuthToken(token);
      let bId = businessId;
      if (!bId) {
        const bizRes = await api.get('/businesses/me');
        bId = bizRes.data.id;
        setBusinessId(bId);
      }
      if (!bId) {
        console.log('Purchase Bills load: missing business_id');
        return;
      }
      const res = await api.get(`/purchase-bills/?limit=${LIMIT}&skip=${currentSkip}&business_id=${bId}`);
      const responseData = res.data;

      const newItems = Array.isArray(responseData)
        ? responseData
        : Array.isArray(responseData?.items)
        ? responseData.items
        : [];
      
      const totalCount = typeof responseData?.total === 'number'
        ? responseData.total
        : Array.isArray(responseData)
        ? responseData.length
        : 0;

      setTotal(totalCount);
      setSkip(currentSkip);

      if (currentSkip === 0) {
        setBills(newItems);
      } else {
        setBills(prev => {
          const existingIds = new Set(prev.map((item: PurchaseBill) => item.id));
          const filteredNewItems = newItems.filter((item: PurchaseBill) => !existingIds.has(item.id));
          return [...prev, ...filteredNewItems];
        });
      }
    } catch (err: any) {
      console.log('Purchase Bills load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBills(0);
    }, [])
  );

  const filtered = bills.filter(bill => {
    const sLower = search.toLowerCase().trim();
    const supplierName = bill.supplier?.name || (bill as any).supplier_name || (bill as any).vendor_name || '';
    const invoiceNum = bill.supplier_invoice_number || (bill as any).invoice_number || (bill as any).bill_number || '';
    const supplierPhone = (bill.supplier as any)?.phone || '';
    const supplierGstin = bill.supplier?.gstin || '';

    const matchSearch = !sLower ||
      supplierName.toLowerCase().includes(sLower) ||
      invoiceNum.toLowerCase().includes(sLower) ||
      supplierPhone.toLowerCase().includes(sLower) ||
      supplierGstin.toLowerCase().includes(sLower);

    const ps = (bill.payment_status || 'UNPAID').toUpperCase();
    let matchFilter = true;
    if (filter === 'Unpaid') {
      matchFilter = ps === 'UNPAID';
    } else if (filter === 'Partial') {
      matchFilter = ps === 'PARTIAL';
    } else if (filter === 'Paid') {
      matchFilter = ps === 'PAID';
    }
    return matchSearch && matchFilter;
  });

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  const loadMore = () => {
    if (loading || loadingMore) return;
    if (skip + LIMIT < total) {
      loadBills(skip + LIMIT);
    }
  };

  const renderEmptyComponent = () => {
    if (loading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 14 }}>Loading...</Text>
        </View>
      );
    }
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
        <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
        <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '500', marginTop: 12 }}>No purchase bills</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Purchase Bills</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/purchase-bills/create')}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by supplier or bill number..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={{ height: 44, marginBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center', height: 44 }}
        >
          {['All', 'Unpaid', 'Paid', 'Partial'].map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.chip, filter === f && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item: bill }) => {
          const ps = (bill.payment_status || 'UNPAID').toUpperCase();
          const isPaid = ps === 'PAID';
          const isPartial = ps === 'PARTIAL';
          return (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/purchase-bills/${bill.id}`)}>
              <View style={styles.cardIcon}>
                <Ionicons name="receipt-outline" size={18} color={Colors.textSecondary} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{bill.supplier?.name || 'Unknown Supplier'}</Text>
                <Text style={styles.cardSub} textBreakStrategy="simple">
                  {bill.supplier_invoice_number || 'No Number'} · {bill.bill_date ? new Date(bill.bill_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardAmount}>{fmt(bill.total_amount)}</Text>
                <View style={[
                  styles.badge,
                  isPaid ? styles.paidBadge :
                  isPartial ? styles.partialBadge :
                  styles.unpaidBadge
                ]}>
                  <Text style={[
                    styles.badgeText,
                    isPaid ? styles.paidText :
                    isPartial ? styles.partialText :
                    styles.unpaidText
                  ]}>{ps}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={[styles.list, (loading || filtered.length === 0) && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadBills(0, true);
            }}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={renderEmptyComponent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ paddingVertical: 12 }} color={Colors.primary} />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#0f172a' },
  addBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, marginHorizontal: 12, marginTop: 12, marginBottom: 8, borderRadius: Radius.sm, paddingHorizontal: 12, height: 44, borderWidth: 0.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text, height: '100%', paddingVertical: 0 },
  chip: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  chipText: { fontSize: 13, color: '#64748b', fontWeight: '500', lineHeight: 16 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingTop: 4, paddingHorizontal: 12, paddingBottom: 80, gap: 8 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 13, fontWeight: '500', color: Colors.text },
  cardSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2, flexShrink: 1 },
  cardRight: { alignItems: 'flex-end' },
  cardAmount: { fontSize: 13, fontWeight: '600', color: Colors.text },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  paidBadge: { backgroundColor: '#F0FDF4' },
  unpaidBadge: { backgroundColor: '#FFF7ED' },
  partialBadge: { backgroundColor: '#EFF6FF' },
  badgeText: { fontSize: 9, fontWeight: '600' },
  paidText: { color: Colors.success },
  unpaidText: { color: '#EA580C' },
  partialText: { color: '#2563EB' },
});
