import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, RefreshControl,
  ActivityIndicator, FlatList, Alert
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBottomPadding } from '../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken, API_BASE_URL } from '../../services/api';
import { showApiError } from '../../utils/apiError';
import * as FileSystem from 'expo-file-system/legacy';
import { savePdfToAndroidOrShare } from '../../services/safHelper';

const FILTERS = ['All', 'Receivables', 'Unpaid', 'Paid', 'Partial'];

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  total_amount: number;
  status: string;
  payment_status?: string;
  invoice_date: string;
}

export default function BillsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = useBottomPadding(20);
  const getInitials = (name: string) => name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const { initialFilter } = useLocalSearchParams<{ initialFilter?: string }>();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [businessId, setBusinessId] = useState<string>('');
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 20;

  useEffect(() => {
    if (initialFilter) {
      if (initialFilter === 'Receivables' || initialFilter === 'Outstanding') {
        setFilter('Receivables');
      } else if (FILTERS.includes(initialFilter)) {
        setFilter(initialFilter);
      }
    }
  }, [initialFilter]);

  const handleDownloadReportPdf = async () => {
    setDownloadingPdf(true);
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
        Alert.alert('Error', 'Business not found');
        return;
      }

      let statusParam = 'all';
      if (filter === 'Unpaid') statusParam = 'unpaid';
      else if (filter === 'Paid') statusParam = 'paid';
      else if (filter === 'Partial') statusParam = 'partial';
      else if (filter === 'Receivables' || filter === 'Outstanding') statusParam = 'receivables';

      const todayStr = new Date().toISOString().split('T')[0];
      const fileName = `Sales_Bills_${statusParam}_${todayStr}.pdf`;
      const pdfUrl = `${API_BASE_URL}/invoices/report-pdf?business_id=${bId}&status=${statusParam}`;
      const fileUri = (FileSystem as any).cacheDirectory + fileName;

      const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (downloadResult.status === 200) {
        await savePdfToAndroidOrShare(downloadResult.uri, fileName, 'Sales Report');
      } else {
        throw new Error('Download failed');
      }
    } catch (err: any) {
      console.log('Download sales report PDF error:', err);
      Alert.alert('Error', 'Could not download sales report PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const loadInvoices = async (currentSkip = 0, isRefreshing = false) => {
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
        console.log('Bills load: missing business_id');
        return;
      }
      const res = await api.get(`/invoices/?limit=${LIMIT}&skip=${currentSkip}&sort=desc&business_id=${bId}`);
      const responseData = res.data;
      
      const newItems = Array.isArray(responseData)
        ? responseData
        : Array.isArray(responseData?.items)
        ? responseData.items
        : Array.isArray(responseData?.invoices)
        ? responseData.invoices
        : [];
      
      const totalCount = typeof responseData?.total === 'number'
        ? responseData.total
        : Array.isArray(responseData)
        ? responseData.length
        : 0;
        
      setTotal(totalCount);
      setSkip(currentSkip);

      if (currentSkip === 0) {
        setInvoices(newItems);
      } else {
        setInvoices(prev => {
          const existingIds = new Set(prev.map((item: Invoice) => item.id));
          const filteredNewItems = newItems.filter((item: Invoice) => !existingIds.has(item.id));
          return [...prev, ...filteredNewItems];
        });
      }
    } catch (err: any) {
      console.log('Bills load error:', JSON.stringify(err?.response?.data), err?.message);
      showApiError(err, 'Failed to load bills');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadInvoices(0);
    }, [])
  );

  const filtered = invoices.filter(inv => {
    const matchSearch = !search || inv.customer_name?.toLowerCase().includes(search.toLowerCase()) || inv.invoice_number?.toLowerCase().includes(search.toLowerCase());
    const ps = (inv.payment_status || inv.status || '').toUpperCase();
    let matchFilter = true;
    if (filter === 'Unpaid') {
      matchFilter = ps === 'UNPAID';
    } else if (filter === 'Partial') {
      matchFilter = ps === 'PARTIAL';
    } else if (filter === 'Paid') {
      matchFilter = ps === 'PAID';
    } else if (filter === 'Receivables' || filter === 'Outstanding') {
      matchFilter = ps === 'UNPAID' || ps === 'PARTIAL';
    }
    return matchSearch && matchFilter;
  });

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  const loadMore = () => {
    if (loading || loadingMore) return;
    if (invoices.length < total) {
      loadInvoices(skip + LIMIT);
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
        <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
        <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '500', marginTop: 12 }}>No invoices</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Bills</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={handleDownloadReportPdf}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <>
                <Ionicons name="download-outline" size={15} color={Colors.primary} />
                <Text style={styles.actionBtnSecondaryText}>PDF</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quotationsLinkBtn}
            onPress={() => router.push('/quotations')}
          >
            <Ionicons name="document-text-outline" size={15} color={Colors.primary} />
            <Text style={styles.quotationsLinkText}>Quotations</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/invoice/create')}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by party or invoice number..."
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
          {FILTERS.map(f => (
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
        renderItem={({ item: inv }) => {
          const ps = (inv.payment_status || (inv.status === 'DRAFT' ? 'DRAFT' : 'UNPAID')).toUpperCase();
          const isPaid = ps === 'PAID';
          const isPartial = ps === 'PARTIAL';
          const isDraft = ps === 'DRAFT' || inv.status === 'DRAFT';
          return (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/invoice/${inv.id}`)}>
              <View style={styles.avatarCircleSmall}>
                <Text style={styles.avatarSmallText}>{getInitials(inv.customer_name)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{inv.customer_name || 'Unknown Party'}</Text>
                <Text style={styles.cardSub} textBreakStrategy="simple">{inv.invoice_number} · {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardAmount}>{fmt(inv.total_amount)}</Text>
                <View style={[
                  styles.badge,
                  isPaid ? styles.paidBadge :
                  isPartial ? styles.partialBadge :
                  isDraft ? styles.draftBadge :
                  styles.unpaidBadge
                ]}>
                  <Text style={[
                    styles.badgeText,
                    isPaid ? styles.paidText :
                    isPartial ? styles.partialText :
                    isDraft ? styles.draftText :
                    styles.unpaidText
                  ]}>{isDraft ? 'DRAFT' : ps}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={[styles.list, (loading || filtered.length === 0) && { flexGrow: 1 }, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadInvoices(0, true);
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
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: '#FED7AA',
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  quotationsLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: '#FED7AA',
  },
  quotationsLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  addBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, marginHorizontal: 12, marginTop: 12, marginBottom: 8, borderRadius: Radius.sm, paddingHorizontal: 12, height: 44, borderWidth: 0.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text, height: '100%', paddingVertical: 0 },
  chip: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  chipText: { fontSize: 13, color: '#64748b', fontWeight: '500', lineHeight: 16 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 4, paddingHorizontal: 12, paddingBottom: 80, gap: 8 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  avatarCircleSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  avatarSmallText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 13, fontWeight: '500', color: Colors.text },
  cardSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2, flexShrink: 1 },
  cardRight: { alignItems: 'flex-end' },
  cardAmount: { fontSize: 13, fontWeight: '600', color: Colors.text },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  paidBadge: { backgroundColor: '#F0FDF4' },
  unpaidBadge: { backgroundColor: '#FFF7ED' },
  partialBadge: { backgroundColor: '#EFF6FF' },
  draftBadge: { backgroundColor: '#F8FAFC' },
  badgeText: { fontSize: 9, fontWeight: '600' },
  paidText: { color: Colors.success },
  unpaidText: { color: '#EA580C' },
  partialText: { color: '#2563EB' },
  draftText: { color: Colors.textSecondary },
});
