import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl,
  ActivityIndicator, BackHandler, Alert, FlatList
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBottomPadding } from '../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import DateRangePicker from '../../components/DateRangePicker';

interface DayBookEntry {
  date: string;
  type: string;
  reference_no: string;
  party_name: string;
  debit: number;
  credit: number;
}

const getRecentMonths = () => {
  const list = [];
  const date = new Date();
  for (let i = 0; i < 6; i++) {
    const mName = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    const monthNum = date.getMonth() + 1;
    list.push({
      label: `${mName} ${year}`,
      startDate: `${year}-${String(monthNum).padStart(2, '0')}-01`,
      endDate: `${year}-${String(monthNum).padStart(2, '0')}-${String(new Date(year, monthNum, 0).getDate()).padStart(2, '0')}`
    });
    date.setMonth(date.getMonth() - 1);
  }
  return list;
};

const FILTER_CHIPS = ['ALL', 'SALES', 'PURCHASE', 'PAYMENT', 'RECEIPT', 'RENTAL'];

export default function DayBookReportScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = useBottomPadding(120);
  const recentMonths = getRecentMonths();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<DayBookEntry[]>([]);
  const [activeChip, setActiveChip] = useState('ALL');

  // Filter states
  const [filterType, setFilterType] = useState<'monthly' | 'custom'>('monthly');
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const PAGE_SIZE = 20;
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadData = useCallback(async (currentSkip = 0, isRefreshing = false) => {
    if (currentSkip === 0) {
      if (!isRefreshing) setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const token = await getToken();
      setAuthToken(token);
      
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;

      let start = '';
      let end = '';

      if (filterType === 'monthly') {
        start = recentMonths[selectedMonthIdx].startDate;
        end = recentMonths[selectedMonthIdx].endDate;
      } else {
        start = startDate || recentMonths[0].startDate;
        end = endDate || recentMonths[0].endDate;
      }

      const res = await api.get('/ledger/transactions', {
        params: {
          business_id: bId,
          from_date: start,
          to_date: end,
          sort_order: 'desc',
          limit: PAGE_SIZE,
          skip: currentSkip
        }
      });

      const data = res.data;
      const newItems = data.items || data;
      const serverTotal = data.total || newItems.length;

      const list = Array.isArray(newItems) ? newItems : [];
      const parsedItems = list.map((t: any) => ({
        date: t.date || '—',
        type: t.type || '—',
        reference_no: t.reference_no || '—',
        party_name: t.party_name || 'Walk-in Customer',
        debit: Number(t.debit || 0),
        credit: Number(t.credit || 0)
      }));

      if (currentSkip === 0) {
        setTransactions(parsedItems);
      } else {
        setTransactions(prev => [...prev, ...parsedItems]);
      }
      setTotal(serverTotal);
      setSkip(currentSkip);
      setHasMore(currentSkip + PAGE_SIZE < serverTotal);

    } catch (err) {
      console.log('Error loading day-book:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [getToken, filterType, selectedMonthIdx, startDate, endDate]);

  useEffect(() => {
    loadData(0);
  }, [filterType, selectedMonthIdx, startDate, endDate]);

  const handleLoadMore = () => {
    if (loadingMore || !hasMore || loading) return;
    loadData(skip + PAGE_SIZE);
  };

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.replace('/reports');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
  );

  const filtered = transactions.filter(t => {
    if (activeChip === 'ALL') return true;
    const typeUpper = t.type.toUpperCase();
    if (activeChip === 'SALES') {
      return typeUpper.includes('SALES') || typeUpper.includes('INVOICE');
    }
    if (activeChip === 'PURCHASE') {
      return typeUpper.includes('PURCHASE') || typeUpper.includes('BILL');
    }
    if (activeChip === 'PAYMENT') {
      return typeUpper.includes('SUPPLIER PAYMENT');
    }
    if (activeChip === 'RECEIPT') {
      return typeUpper.includes('PAYMENT RECEIVED') || typeUpper.includes('RECEIPT');
    }
    if (activeChip === 'RENTAL') {
      return typeUpper.includes('RENTAL');
    }
    return true;
  });

  const totalDebit = filtered.reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = filtered.reduce((sum, t) => sum + t.credit, 0);

  const fmt = (n: number) => n === 0 ? '—' : '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.replace('/reports')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Day Book (Ledger)</Text>
        </View>
      </View>

      {/* Date Filter Layout */}
      <View style={styles.filterBar}>
        <View style={styles.filterToggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, filterType === 'monthly' && styles.toggleBtnActive]}
            onPress={() => setFilterType('monthly')}
          >
            <Text style={[styles.toggleText, filterType === 'monthly' && styles.toggleTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, filterType === 'custom' && styles.toggleBtnActive]}
            onPress={() => setFilterType('custom')}
          >
            <Text style={[styles.toggleText, filterType === 'custom' && styles.toggleTextActive]}>Custom Range</Text>
          </TouchableOpacity>
        </View>

        {filterType === 'monthly' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthsScroll}>
            {recentMonths.map((m, idx) => (
              <TouchableOpacity
                key={m.label}
                style={[styles.monthCard, selectedMonthIdx === idx && styles.monthCardActive]}
                onPress={() => setSelectedMonthIdx(idx)}
              >
                <Text style={[styles.monthText, selectedMonthIdx === idx && styles.monthTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onApply={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
          />
        )}
      </View>

      {/* Horizontal filter chips */}
      <View style={styles.chipsSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {FILTER_CHIPS.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, activeChip === c && styles.chipActive]}
              onPress={() => setActiveChip(c)}
            >
              <Text style={[styles.chipText, activeChip === c && styles.chipTextActive]}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Column Headers */}
      <View style={styles.columnHeader}>
        <Text style={[styles.colTitle, { flex: 2 }]}>Date / Reference</Text>
        <Text style={[styles.colTitle, { flex: 2 }]}>Party / Type</Text>
        <Text style={[styles.colTitle, { flex: 1.2, textAlign: 'right' }]}>Debit (Dr)</Text>
        <Text style={[styles.colTitle, { flex: 1.2, textAlign: 'right' }]}>Credit (Cr)</Text>
      </View>

      {/* Transaction List */}
      <FlatList
        data={filtered}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={[styles.scrollList, (loading || filtered.length === 0) && { flexGrow: 1 }, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData(0, true);
            }}
            colors={[Colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ paddingVertical: 16 }} color={Colors.primary} /> : null}
        ListEmptyComponent={() => (
          loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 13 }}>Fetching ledger...</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="book-outline" size={48} color="#cbd5e1" />
              <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 12 }}>
                No ledger entries found
              </Text>
            </View>
          )
        )}
        renderItem={({ item: t, index: idx }) => {
            const isSale = t.type.toUpperCase().includes('SALES') || t.type.toUpperCase().includes('INVOICE');
            const isPur = t.type.toUpperCase().includes('PURCHASE') || t.type.toUpperCase().includes('BILL');
            const isRent = t.type.toUpperCase().includes('RENTAL');
            let badgeBg = '#f5f3ff';
            let badgeText = '#7c3aed';
            if (isSale) {
              badgeBg = '#f0fdf4';
              badgeText = Colors.success;
            } else if (isPur) {
              badgeBg = '#f0f9ff';
              badgeText = Colors.info;
            } else if (isRent) {
              badgeBg = '#fff7ed';
              badgeText = Colors.primary;
            }

            return (
              <View style={styles.trCard}>
                <View style={{ flex: 2, gap: 2 }}>
                  <Text style={styles.trDate}>{t.date}</Text>
                  <Text style={styles.trRef} numberOfLines={1}>{t.reference_no}</Text>
                </View>
                <View style={{ flex: 2, gap: 4 }}>
                  <Text style={styles.trParty} numberOfLines={1}>{t.party_name}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.typeBadgeText, { color: badgeText }]} numberOfLines={1}>
                      {t.type}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.trAmount, { flex: 1.2, color: Colors.danger, fontWeight: t.debit > 0 ? '700' : '400' }]}>
                  {fmt(t.debit)}
                </Text>
                <Text style={[styles.trAmount, { flex: 1.2, color: Colors.success, fontWeight: t.credit > 0 ? '700' : '400' }]}>
                  {fmt(t.credit)}
                </Text>
              </View>
            );
        }}
      />

      {/* Sticky Totals Bar */}
      {filtered.length > 0 && !loading && (
        <View style={[styles.totalsBar, { bottom: 60 + insets.bottom }]}>
          <Text style={styles.totalsTitle}>Totals ({filtered.length})</Text>
          <View style={styles.totalsRow}>
            <View style={styles.totalsCell}>
              <Text style={styles.totalsCellLabel}>Total Debit</Text>
              <Text style={[styles.totalsCellVal, { color: Colors.danger }]}>{fmt(totalDebit)}</Text>
            </View>
            <View style={styles.totalsCell}>
              <Text style={styles.totalsCellLabel}>Total Credit</Text>
              <Text style={[styles.totalsCellVal, { color: Colors.success }]}>{fmt(totalCredit)}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },

  filterBar: { backgroundColor: Colors.card, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border, gap: 10 },
  filterToggleRow: { flexDirection: 'row', alignSelf: 'center', backgroundColor: '#F1F5F9', borderRadius: Radius.sm, padding: 3, width: '92%' },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  toggleBtnActive: { backgroundColor: '#fff', elevation: 1 },
  toggleText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  toggleTextActive: { color: Colors.text, fontWeight: '700' },

  monthsScroll: { paddingHorizontal: 12, gap: 8 },
  monthCard: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  monthCardActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  monthText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  monthTextActive: { color: Colors.primary, fontWeight: '700' },



  chipsSection: { backgroundColor: Colors.card, paddingBottom: 10 },
  chipsScroll: { paddingHorizontal: 12, gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.sm, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  columnHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  colTitle: { fontSize: 10, color: Colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' },

  scrollList: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 140, gap: 8 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200 },

  trCard: { backgroundColor: Colors.card, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 10, borderWidth: 0.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center' },
  trDate: { fontSize: 11, fontWeight: '700', color: Colors.text },
  trRef: { fontSize: 10, color: Colors.textMuted },
  trParty: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  typeBadge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginTop: 3 },
  typeBadgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', includeFontPadding: false },
  trAmount: { fontSize: 12, textAlign: 'right' },

  totalsBar: { position: 'absolute', left: 0, right: 0, backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: '#334155', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalsTitle: { fontSize: 11, fontWeight: '700', color: '#fff' },
  totalsRow: { flexDirection: 'row', flex: 1, justifyContent: 'flex-end', gap: 12 },
  totalsCell: { alignItems: 'flex-end', flex: 1 },
  totalsCellLabel: { fontSize: 10, color: '#94a3b8', includeFontPadding: false, textAlign: 'right', width: '100%' },
  totalsCellVal: { fontSize: 12, fontWeight: '700', marginTop: 1, textAlign: 'right', width: '100%' }
});
