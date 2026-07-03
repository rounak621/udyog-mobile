import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, Share, BackHandler, RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date?: string;
  created_at?: string;
  customer_name?: string;
  customer?: { name: string; gstin?: string; gst_number?: string };
  customer_gstin?: string;
  taxable_amount: number;
  total_tax: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_amount: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const generateMonths = () => {
  const months = [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentFYStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const startYear = currentFYStartYear - 1;
  
  let month = 3; // April
  let year = startYear;

  while (year < currentYear || (year === currentYear && month <= currentMonth)) {
    months.push(`${MONTH_NAMES[month]} ${year}`);
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return months.reverse();
};

export default function Gstr1Screen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payload, setPayload] = useState<any>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(true);

  const months = generateMonths();
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const token = await getToken();
      setAuthToken(token);

      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;

      const [m, y] = months[selectedMonthIdx].split(' ');
      const monthIndex = MONTH_NAMES.indexOf(m) + 1;
      const year = parseInt(y, 10);
      const monthStr = `${year}-${String(monthIndex).padStart(2, '0')}`;

      const lastDay = new Date(year, monthIndex, 0).getDate();
      const startDate = `${year}-${String(monthIndex).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(monthIndex).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const [invRes, gstrRes] = await Promise.all([
        api.get(`/invoices/?business_id=${bId}&start_date=${startDate}&end_date=${endDate}`),
        api.get(`/exports/gstr1-json?business_id=${bId}&month=${monthStr}`)
      ]);

      const rawInvoices = Array.isArray(invRes.data) ? invRes.data : invRes.data?.items || [];
      // Filter out non-gst invoices if necessary, matching backend
      const gstOnlyInvoices = rawInvoices.filter((inv: any) => !(inv.invoice_number || '').startsWith('NONGST-'));
      
      setInvoices(gstOnlyInvoices);
      setPayload(gstrRes.data.gstr1_payload || gstrRes.data);
      setWarnings(gstrRes.data.validation_warnings || []);
      setError(null);
    } catch (err: any) {
      console.log('GSTR1 error:', err);
      setError('Failed to fetch GSTR-1 statement data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, selectedMonthIdx]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleShare = async () => {
    if (!payload) {
      Alert.alert('No Data', 'GSTR-1 JSON payload is not loaded yet.');
      return;
    }
    try {
      const jsonString = JSON.stringify(payload, null, 2);
      await Share.share({
        message: jsonString,
        title: 'GSTR-1 Export JSON',
      });
    } catch (err) {
      Alert.alert('Share Error', 'Failed to share GSTR-1 JSON.');
    }
  };

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // Calculation totals
  const totalTaxable = invoices.reduce((sum, inv) => sum + Number(inv.taxable_amount || 0), 0);
  const totalCGST = invoices.reduce((sum, inv) => sum + Number(inv.cgst_amount || 0), 0);
  const totalSGST = invoices.reduce((sum, inv) => sum + Number(inv.sgst_amount || 0), 0);
  const totalIGST = invoices.reduce((sum, inv) => sum + Number(inv.igst_amount || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/more')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>GSTR-1 Report</Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Ionicons name="share-social-outline" size={20} color="#fff" />
            <Text style={styles.shareTxt}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Months selector filter bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthsScroll}>
          {months.map((m, idx) => {
            const isActive = selectedMonthIdx === idx;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => {
                  setSelectedMonthIdx(idx);
                  setLoading(true);
                }}
                style={[styles.monthCard, isActive && styles.monthCardActive]}
              >
                <Text style={[styles.monthText, isActive && styles.monthTextActive]}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
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
        {/* Warning Banner */}
        {warnings.length > 0 && showWarnings && (
          <View style={styles.warningBanner}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
              <Ionicons name="warning" size={16} color="#d97706" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>{warnings.length} Compliance Warnings</Text>
                {warnings.slice(0, 3).map((w, idx) => (
                  <Text key={idx} style={styles.warningText}>• {w}</Text>
                ))}
                {warnings.length > 3 && (
                  <Text style={styles.warningText}>and {warnings.length - 3} more warnings...</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowWarnings(false)}>
                <Ionicons name="close" size={18} color="#78350f" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 13 }}>Calculating GST summary...</Text>
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={48} color="#cbd5e1" />
            <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 12 }}>{error}</Text>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {/* Stat cards */}
            <View style={styles.statsStrip}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Taxable</Text>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{fmt(totalTaxable)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>CGST</Text>
                <Text style={[styles.statValue, { color: Colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(totalCGST)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>SGST</Text>
                <Text style={[styles.statValue, { color: Colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(totalSGST)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>IGST</Text>
                <Text style={[styles.statValue, { color: Colors.info }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(totalIGST)}</Text>
              </View>
            </View>

            {/* Invoices List table */}
            <View style={styles.detailCard}>
              <Text style={styles.cardHeaderTitle}>Invoices Summary ({invoices.length})</Text>
              {invoices.length === 0 ? (
                <Text style={styles.emptyTableTxt}>No transactions recorded in this period.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View style={{ flexDirection: 'column' }}>
                    <View style={styles.tableRowHeader}>
                      {['Invoice No', 'Date', 'Customer', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'].map((h, i) => (
                        <Text key={i} style={[styles.tableColHeader, { width: i === 2 ? 140 : i === 3 ? 120 : 90 }]}>
                          {h}
                        </Text>
                      ))}
                    </View>
                    {invoices.map((inv, idx) => (
                      <View key={inv.id || idx} style={styles.tableRow}>
                        <Text style={[styles.tableCellVal, { width: 90, fontWeight: '700' }]}>{inv.invoice_number}</Text>
                        <Text style={[styles.tableCellVal, { width: 90 }]}>{inv.invoice_date || '—'}</Text>
                        <Text style={[styles.tableCellVal, { width: 140 }]} numberOfLines={1}>{inv.customer_name || inv.customer?.name || 'Walk-in'}</Text>
                        <Text style={[styles.tableCellVal, { width: 120, fontFamily: 'monospace', fontSize: 10 }]}>{inv.customer_gstin || inv.customer?.gstin || inv.customer?.gst_number || '—'}</Text>
                        <Text style={[styles.tableCellVal, { width: 90, textAlign: 'right' }]}>{fmt(inv.taxable_amount)}</Text>
                        <Text style={[styles.tableCellVal, { width: 90, textAlign: 'right' }]}>{fmt(inv.cgst_amount || 0)}</Text>
                        <Text style={[styles.tableCellVal, { width: 90, textAlign: 'right' }]}>{fmt(inv.sgst_amount || 0)}</Text>
                        <Text style={[styles.tableCellVal, { width: 90, textAlign: 'right' }]}>{fmt(inv.igst_amount || 0)}</Text>
                        <Text style={[styles.tableCellVal, { width: 90, textAlign: 'right', fontWeight: '700', color: Colors.text }]}>{fmt(inv.total_amount)}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text },
  shareBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, gap: 4 },
  shareTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  filterBar: { backgroundColor: Colors.card, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  monthsScroll: { paddingHorizontal: 12, gap: 8 },
  monthCard: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  monthCardActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  monthText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  monthTextActive: { color: Colors.primary, fontWeight: '700' },
  scrollList: { paddingTop: 12, paddingHorizontal: 12, paddingBottom: 80 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 40 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', marginVertical: 40 },
  warningBanner: { backgroundColor: '#fef3c7', borderRadius: Radius.md, borderWidth: 1, borderColor: '#f59e0b', padding: 10, marginBottom: 12 },
  warningTitle: { fontSize: 12, fontWeight: '700', color: '#78350f', marginBottom: 4 },
  warningText: { fontSize: 10.5, color: '#92400e', lineHeight: 14 },
  statsStrip: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 8, alignItems: 'center' },
  statLabel: { fontSize: 9, color: Colors.textSecondary, fontWeight: '500', marginBottom: 4 },
  statValue: { fontSize: 12.5, fontWeight: '700', color: Colors.text },
  detailCard: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, gap: 10 },
  cardHeaderTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  emptyTableTxt: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  tableRowHeader: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 8 },
  tableColHeader: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', paddingHorizontal: 6 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingVertical: 10, alignItems: 'center' },
  tableCellVal: { fontSize: 11, color: Colors.textSecondary, paddingHorizontal: 6 }
});
