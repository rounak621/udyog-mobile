import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl,
  ActivityIndicator, BackHandler, Alert
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { saveCsvToAndroidOrShare, savePdfToAndroidOrShare } from '../../services/safHelper';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeScrollView } from '../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import DateRangePicker from '../../components/DateRangePicker';
import { escapeHtml } from '../../utils/escapeHtml';

interface PurchaseBill {
  id: string;
  bill_number: string;
  bill_date: string;
  vendor_name: string;
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

export default function PurchaseReportScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recentMonths = getRecentMonths();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [bills, setBills] = useState<PurchaseBill[]>([]);

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

      const res = await api.get('/purchase-bills/', {
        params: {
          business_id: bId,
          skip: 0,
          limit: 500,
          start_date: start,
          end_date: end
        }
      });

      const raw = res.data;
      const list = Array.isArray(raw) ? raw :
                   Array.isArray(raw?.items) ? raw.items :
                   Array.isArray(raw?.bills) ? raw.bills : [];

      setBills(list.map((bill: any) => ({
        id: bill.id,
        bill_number: bill.supplier_invoice_number || bill.bill_number || '—',
        bill_date: bill.bill_date || bill.created_at || '—',
        vendor_name: bill.supplier?.name || bill.vendor_name || bill.supplier_name || 'Unknown Supplier',
        taxable_amount: Number(bill.subtotal || bill.taxable_amount || 0),
        total_tax: Number(bill.tax_amount || (Number(bill.cgst_amount || 0) + Number(bill.sgst_amount || 0) + Number(bill.igst_amount || 0)) || 0),
        total_amount: Number(bill.total_amount || 0),
        payment_status: bill.payment_status || 'UNPAID'
      })));

    } catch (err) {
      console.log('Error loading purchase report:', err);
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
        router.replace('/reports');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
  );

  // Stats calculation
  const totalPurchasesVal = bills.reduce((sum, bill) => sum + bill.total_amount, 0);
  const totalGstVal = bills.reduce((sum, bill) => sum + bill.total_tax, 0);
  const totalTaxableVal = bills.reduce((sum, bill) => sum + bill.taxable_amount, 0);
  const billsCount = bills.length;
  const paidCount = bills.filter(bill => bill.payment_status.toUpperCase() === 'PAID').length;

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
    if (bills.length === 0) {
      Alert.alert('No Data', 'There are no purchase bills to export for this period.');
      return;
    }

    setExportingCsv(true);
    try {
      const headers = ['Bill No', 'Date', 'Vendor Name', 'Taxable Amount', 'GST', 'Total Amount', 'Status'];
      const rows = bills.map(bill => [
        escapeCsv(bill.bill_number),
        escapeCsv(bill.bill_date),
        escapeCsv(bill.vendor_name),
        escapeCsv(bill.taxable_amount.toFixed(2)),
        escapeCsv(bill.total_tax.toFixed(2)),
        escapeCsv(bill.total_amount.toFixed(2)),
        escapeCsv(bill.payment_status)
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\n');

      const periodLabel = filterType === 'monthly'
        ? recentMonths[selectedMonthIdx].label.replace(/\s+/g, '_')
        : 'Custom';
      const fileName = `Purchase_Report_${periodLabel}.csv`;
      const fileUri = (FileSystem as any).cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await saveCsvToAndroidOrShare(fileUri, fileName, 'Export Purchase Report');
    } catch (err) {
      console.log('CSV export error:', err);
      Alert.alert('Error', 'Failed to export Purchase Report CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    if (bills.length === 0) {
      Alert.alert('No Data', 'There are no purchase bills to export for this period.');
      return;
    }

    setExportingPdf(true);
    try {
      const periodLabel = filterType === 'monthly'
        ? recentMonths[selectedMonthIdx].label
        : `${startDate || 'Start'} to ${endDate || 'End'}`;

      const rowsHtml = bills.map((bill, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
          <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${escapeHtml(bill.bill_number)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #E2E8F0;">${escapeHtml(bill.bill_date)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #E2E8F0;">${escapeHtml(bill.vendor_name)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; text-align: right;">₹${bill.taxable_amount.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; text-align: right;">₹${bill.total_tax.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600;">₹${bill.total_amount.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${
              bill.payment_status.toUpperCase() === 'PAID'
                ? 'background-color: #DCFCE7; color: #166534;'
                : 'background-color: #FEF2F2; color: #991B1B;'
            }">${escapeHtml(bill.payment_status)}</span>
          </td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; color: #1E293B; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #F97316; padding-bottom: 12px; margin-bottom: 20px; }
              .title { font-size: 22px; font-weight: 800; color: #F97316; margin: 0; }
              .subtitle { font-size: 13px; color: #64748B; margin-top: 4px; }
              .stats-grid { display: flex; gap: 12px; margin-bottom: 24px; }
              .stat-card { flex: 1; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; }
              .stat-label { font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase; }
              .stat-value { font-size: 16px; font-weight: 800; color: #0F172A; margin-top: 4px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
              th { background-color: #F1F5F9; color: #475569; font-weight: 700; padding: 10px 8px; text-align: left; border-bottom: 2px solid #CBD5E1; }
              th.right, td.right { text-align: right; }
              th.center, td.center { text-align: center; }
              .footer { margin-top: 24px; font-size: 11px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1 class="title">Purchase Report</h1>
                <div class="subtitle">Period: ${escapeHtml(periodLabel)}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 16px; font-weight: 800; color: #1E293B;">Udyog</div>
                <div style="font-size: 11px; color: #64748B;">GST Billing & Accounting</div>
              </div>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total Purchase</div>
                <div class="stat-value">₹${totalPurchasesVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total GST</div>
                <div class="stat-value">₹${totalGstVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Taxable Amount</div>
                <div class="stat-value">₹${totalTaxableVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Bills</div>
                <div class="stat-value">${billsCount}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Date</th>
                  <th>Vendor Name</th>
                  <th class="right">Taxable Amount</th>
                  <th class="right">GST</th>
                  <th class="right">Total Amount</th>
                  <th class="center">Status</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="footer">
              Generated automatically via Udyog App
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const fileNameLabel = filterType === 'monthly'
        ? recentMonths[selectedMonthIdx].label.replace(/\s+/g, '_')
        : 'Custom';
      const fileName = `Purchase_Report_${fileNameLabel}.pdf`;

      await savePdfToAndroidOrShare(uri, fileName, 'Export Purchase Report PDF');
    } catch (err) {
      console.log('PDF export error:', err);
      Alert.alert('Error', 'Failed to export Purchase Report PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.headerRow, { justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.replace('/reports')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Purchase Report</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.exportBtn, exportingCsv && { opacity: 0.7 }]}
              onPress={handleExportCsv}
              disabled={exportingCsv || exportingPdf || loading}
            >
              {exportingCsv ? (
                <ActivityIndicator size="small" color="#F97316" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={15} color="#F97316" />
                  <Text style={styles.exportBtnText}>CSV</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportBtn, exportingPdf && { opacity: 0.7 }]}
              onPress={handleExportPdf}
              disabled={exportingCsv || exportingPdf || loading}
            >
              {exportingPdf ? (
                <ActivityIndicator size="small" color="#F97316" />
              ) : (
                <>
                  <Ionicons name="document-outline" size={15} color="#F97316" />
                  <Text style={styles.exportBtnText}>PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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

      {/* Stats Summary cards */}
      <View style={styles.statsStrip}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Purchase</Text>
          <Text style={[styles.statValue, { color: Colors.info }]}>{fmt(totalPurchasesVal)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total GST</Text>
          <Text style={[styles.statValue, { color: Colors.primary }]}>{fmt(totalGstVal)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Bills</Text>
          <Text style={styles.statValue}>{billsCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Paid</Text>
          <Text style={[styles.statValue, { color: Colors.success }]}>{paidCount}</Text>
        </View>
      </View>

      {/* Main List */}
      <SafeScrollView
        baseBottomPadding={140}
        contentContainerStyle={styles.scrollList}
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
            <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 13 }}>Fetching bills...</Text>
          </View>
        ) : bills.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
            <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 12 }}>
              No bills found for this range
            </Text>
          </View>
        ) : (
          bills.map(bill => {
            const status = bill.payment_status.toUpperCase();
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
              <View key={bill.id} style={styles.invCard}>
                <View style={styles.invHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invNum} numberOfLines={1}>{bill.bill_number}</Text>
                    <Text style={styles.invDate}>{bill.bill_date}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.badgeTxt, { color: badgeText }]}>{status}</Text>
                  </View>
                </View>

                <Text style={styles.custName}>{bill.vendor_name}</Text>

                <View style={styles.threeCellRow}>
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>Taxable</Text>
                    <Text style={styles.cellVal}>{fmt(bill.taxable_amount)}</Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>GST</Text>
                    <Text style={styles.cellVal}>{fmt(bill.total_tax)}</Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>Total</Text>
                    <Text style={[styles.cellVal, { fontWeight: '700', color: Colors.text }]}>
                      {fmt(bill.total_amount)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </SafeScrollView>

      {/* Sticky Totals Bar */}
      {bills.length > 0 && !loading && (
        <View style={[styles.totalsBar, { bottom: 60 + insets.bottom }]}>
          <Text style={styles.totalsTitle}>Totals ({billsCount})</Text>
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
              <Text style={[styles.totalsCellVal, { color: Colors.primary }]}>{fmt(totalPurchasesVal)}</Text>
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



  statsStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginTop: 10 },
  statCard: { flex: 1, minWidth: '22%', backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 10, alignItems: 'center' },
  statLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '500', marginBottom: 4, includeFontPadding: false },
  statValue: { fontSize: 13, fontWeight: '700', color: Colors.text },

  scrollList: { paddingTop: 8, paddingHorizontal: 12, gap: 10 },
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
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cellLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 2, includeFontPadding: false, textAlign: 'center', width: '100%' },
  cellVal: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center', width: '100%' },

  totalsBar: { position: 'absolute', left: 0, right: 0, backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: '#334155', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalsTitle: { fontSize: 11, fontWeight: '700', color: '#fff' },
  totalsRow: { flexDirection: 'row', flex: 1, justifyContent: 'flex-end', gap: 8 },
  totalsCell: { alignItems: 'flex-end', flex: 1, maxWidth: 100 },
  totalsCellLabel: { fontSize: 10, color: '#94a3b8', includeFontPadding: false, textAlign: 'right', width: '100%' },
  totalsCellVal: { fontSize: 11, fontWeight: '700', color: '#fff', marginTop: 1, textAlign: 'right', width: '100%' }
});
