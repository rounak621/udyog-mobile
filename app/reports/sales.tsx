import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, RefreshControl,
  ActivityIndicator, BackHandler, Alert
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { saveCsvToAndroidOrShare } from '../../services/safHelper';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  taxable_amount: number;
  total_tax: number;
  total_amount: number;
  payment_status: string;
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

export default function SalesReportScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recentMonths = getRecentMonths();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Filter states
  const [filterType, setFilterType] = useState<'monthly' | 'custom'>('monthly');
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
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

      const res = await api.get('/invoices/', {
        params: {
          business_id: bId,
          skip: 0,
          limit: 1000,
          start_date: start,
          end_date: end
        }
      });

      const raw = res.data;
      const list = Array.isArray(raw) ? raw :
                   Array.isArray(raw?.items) ? raw.items :
                   Array.isArray(raw?.invoices) ? raw.invoices : [];

      setInvoices(list.map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number || '—',
        invoice_date: inv.invoice_date || inv.created_at || '—',
        customer_name: inv.customer_name || inv.customer?.name || 'Walk-in Customer',
        taxable_amount: Number(inv.taxable_amount || 0),
        total_tax: Number(inv.total_tax || 0),
        total_amount: Number(inv.total_amount || 0),
        payment_status: inv.payment_status || 'UNPAID'
      })));

    } catch (err) {
      console.log('Error loading sales report:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, filterType, selectedMonthIdx, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [filterType, selectedMonthIdx]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.replace('/(tabs)/more');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
  );

  // Stats calculation
  const totalSalesVal = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const totalGstVal = invoices.reduce((sum, inv) => sum + inv.total_tax, 0);
  const totalTaxableVal = invoices.reduce((sum, inv) => sum + inv.taxable_amount, 0);
  const invoicesCount = invoices.length;
  const paidCount = invoices.filter(inv => inv.payment_status.toUpperCase() === 'PAID').length;

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const escapeCsv = (str: any) => {
    if (str === null || str === undefined) return '';
    const s = String(str);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const handleExportCsv = async () => {
    if (invoices.length === 0) {
      Alert.alert('No Data', 'There are no sales invoices to export for this period.');
      return;
    }

    setExporting(true);
    try {
      const headers = ['Invoice No', 'Date', 'Customer Name', 'Taxable Amount', 'GST', 'Total Amount', 'Status'];
      const rows = invoices.map(inv => [
        escapeCsv(inv.invoice_number),
        escapeCsv(inv.invoice_date),
        escapeCsv(inv.customer_name),
        escapeCsv(inv.taxable_amount.toFixed(2)),
        escapeCsv(inv.total_tax.toFixed(2)),
        escapeCsv(inv.total_amount.toFixed(2)),
        escapeCsv(inv.payment_status)
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\n');

      const periodLabel = filterType === 'monthly'
        ? recentMonths[selectedMonthIdx].label.replace(/\s+/g, '_')
        : 'Custom';
      const fileName = `Sales_Report_${periodLabel}.csv`;
      const fileUri = (FileSystem as any).cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await saveCsvToAndroidOrShare(fileUri, fileName, 'Export Sales Report');
    } catch (err) {
      console.log('CSV export error:', err);
      Alert.alert('Error', 'Failed to export Sales Report CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.headerRow, { justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.replace('/(tabs)/more')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Sales Report</Text>
          </View>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && { opacity: 0.7 }]}
            onPress={handleExportCsv}
            disabled={exporting || loading}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#F97316" />
            ) : (
              <>
                <Ionicons name="download-outline" size={16} color="#F97316" />
                <Text style={styles.exportBtnText}>Export</Text>
              </>
            )}
          </TouchableOpacity>
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
          <View style={styles.customDateContainer}>
            <TextInput
              style={styles.dateInput}
              placeholder="Start: YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              value={startDate}
              onChangeText={setStartDate}
            />
            <TextInput
              style={styles.dateInput}
              placeholder="End: YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              value={endDate}
              onChangeText={setEndDate}
            />
            <TouchableOpacity style={styles.applyBtn} onPress={loadData}>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Stats Summary cards */}
      <View style={styles.statsStrip}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Sales</Text>
          <Text style={[styles.statValue, { color: Colors.primary }]}>{fmt(totalSalesVal)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total GST</Text>
          <Text style={[styles.statValue, { color: Colors.info }]}>{fmt(totalGstVal)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Invoices</Text>
          <Text style={styles.statValue}>{invoicesCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Paid</Text>
          <Text style={[styles.statValue, { color: Colors.success }]}>{paidCount}</Text>
        </View>
      </View>

      {/* Main List */}
      <ScrollView
        contentContainerStyle={[styles.scrollList, (loading || invoices.length === 0) && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            colors={[Colors.primary]}
          />
        }
      >
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 13 }}>Fetching invoices...</Text>
          </View>
        ) : invoices.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
            <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 12 }}>
              No invoices found for this range
            </Text>
          </View>
        ) : (
          invoices.map(inv => {
            const status = inv.payment_status.toUpperCase();
            let badgeBg = '#fef2f2';
            let badgeText = Colors.danger;
            if (status === 'PAID') {
              badgeBg = '#f0fdf4';
              badgeText = Colors.success;
            } else if (status === 'PARTIAL' || status === 'PARTIALLY PAID') {
              badgeBg = '#fffbeb';
              badgeText = Colors.warning;
            }

            return (
              <View key={inv.id} style={styles.invCard}>
                <View style={styles.invHeader}>
                  <View>
                    <Text style={styles.invNum}>{inv.invoice_number}</Text>
                    <Text style={styles.invDate}>{inv.invoice_date}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.badgeTxt, { color: badgeText }]}>{status}</Text>
                  </View>
                </View>

                <Text style={styles.custName}>{inv.customer_name}</Text>

                <View style={styles.threeCellRow}>
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>Taxable</Text>
                    <Text style={styles.cellVal}>{fmt(inv.taxable_amount)}</Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>GST</Text>
                    <Text style={styles.cellVal}>{fmt(inv.total_tax)}</Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>Total</Text>
                    <Text style={[styles.cellVal, { fontWeight: '700', color: Colors.text }]}>
                      {fmt(inv.total_amount)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Sticky Totals Bar */}
      {invoices.length > 0 && !loading && (
        <View style={styles.totalsBar}>
          <Text style={styles.totalsTitle}>Totals ({invoicesCount})</Text>
          <View style={styles.totalsRow}>
            <View style={styles.totalsCell}>
              <Text style={styles.totalsCellLabel}>Taxable</Text>
              <Text style={styles.totalsCellVal}>{fmt(totalTaxableVal)}</Text>
            </View>
            <View style={styles.totalsCell}>
              <Text style={styles.totalsCellLabel}>GST</Text>
              <Text style={styles.totalsCellVal}>{fmt(totalGstVal)}</Text>
            </View>
            <View style={styles.totalsCell}>
              <Text style={styles.totalsCellLabel}>Total</Text>
              <Text style={[styles.totalsCellVal, { color: Colors.primary }]}>{fmt(totalSalesVal)}</Text>
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
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F97316',
  },

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

  customDateContainer: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, alignItems: 'center' },
  dateInput: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, height: 36, fontSize: 12, color: Colors.text },
  applyBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  statsStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginTop: 10 },
  statCard: { flex: 1, minWidth: '22%', backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 10, alignItems: 'center' },
  statLabel: { fontSize: 9, color: Colors.textSecondary, fontWeight: '500', marginBottom: 4 },
  statValue: { fontSize: 13, fontWeight: '700', color: Colors.text },

  scrollList: { paddingTop: 8, paddingHorizontal: 12, paddingBottom: 140, gap: 10 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  invCard: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, gap: 8 },
  invHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invNum: { fontSize: 13, fontWeight: '700', color: Colors.text },
  invDate: { fontSize: 10, color: Colors.textMuted },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeTxt: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  custName: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  
  threeCellRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 8, marginTop: 2 },
  cell: { flex: 1, alignItems: 'center' },
  cellLabel: { fontSize: 9, color: Colors.textMuted, marginBottom: 2 },
  cellVal: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  totalsBar: { position: 'absolute', bottom: 60, left: 0, right: 0, backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: '#334155', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalsTitle: { fontSize: 12, fontWeight: '700', color: '#fff' },
  totalsRow: { flexDirection: 'row', gap: 12 },
  totalsCell: { alignItems: 'flex-end' },
  totalsCellLabel: { fontSize: 8, color: '#94a3b8' },
  totalsCellVal: { fontSize: 11, fontWeight: '700', color: '#fff', marginTop: 1 }
});
