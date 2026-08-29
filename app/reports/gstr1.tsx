import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Modal, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, BackHandler, RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeScrollView } from '../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { validateGSTIN } from '../../utils/validators';
import { showApiError } from '../../utils/apiError';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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

interface InvalidGstinParty {
  party_id: string;
  party_name: string;
  gstin: string;
  invoice_numbers: string[];
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

const getSelectedMonthStr = (monthLabel: string): string => {
  if (!monthLabel) return '';
  const [m, y] = monthLabel.split(' ');
  const monthIndex = MONTH_NAMES.indexOf(m);
  if (monthIndex === -1 || !y) return '';
  const monthNum = monthIndex + 1;
  const year = parseInt(y, 10);
  if (isNaN(year) || monthNum < 1 || monthNum > 12) return '';
  return `${year}-${String(monthNum).padStart(2, '0')}`;
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

  const [exporting, setExporting] = useState(false);

  // Validation & Blocking states
  const [invalidGstinParties, setInvalidGstinParties] = useState<InvalidGstinParty[]>([]);
  const [bypassGstinBlock, setBypassGstinBlock] = useState(false);

  // Edit modal states
  const [editingParty, setEditingParty] = useState<InvalidGstinParty | null>(null);
  const [editGstinInput, setEditGstinInput] = useState('');
  const [savingGstin, setSavingGstin] = useState(false);

  const months = generateMonths();
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const token = await getToken();
      setAuthToken(token);

      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;

      const monthStr = getSelectedMonthStr(months[selectedMonthIdx]);
      if (!monthStr) {
        setError('Invalid month selected.');
        return;
      }

      const summaryRes = await api.get(`/exports/gstr1-summary?business_id=${bId}&month=${monthStr}`);
      const rawSummary = summaryRes.data?.rows || summaryRes.data || [];
      const summaryInvoices = Array.isArray(rawSummary) ? rawSummary : [];

      setInvoices(summaryInvoices);
      setError(null);
    } catch (err: any) {
      console.log('GSTR1 summary load error:', err);
      setError('Failed to fetch GSTR-1 statement data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, selectedMonthIdx]);

  useEffect(() => {
    setBypassGstinBlock(false);
    loadData();
  }, [loadData]);

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

  const handleSaveGstin = async () => {
    if (!editingParty) return;
    const cleaned = editGstinInput.trim().toUpperCase();
    const gstinRes = validateGSTIN(cleaned);
    if (!gstinRes.isValid) {
      Alert.alert('Invalid GSTIN', gstinRes.error || 'Please enter a valid 15-character GSTIN.');
      return;
    }

    setSavingGstin(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;

      await api.put(`/customers/${editingParty.party_id}?business_id=${bId}`, {
        gstin: cleaned || null
      });

      Alert.alert('Success', `GSTIN for ${editingParty.party_name} updated successfully.`);
      setEditingParty(null);
      loadData();
    } catch (err: any) {
      console.log('Update GSTIN error:', err);
      Alert.alert('Error', 'Failed to update GSTIN. Please try again.');
    } finally {
      setSavingGstin(false);
    }
  };

  const fetchJsonAndShare = async (force = false) => {
    setExporting(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;

      const monthStr = getSelectedMonthStr(months[selectedMonthIdx]);
      if (!monthStr) {
        Alert.alert('Error', 'Invalid month selected.');
        return;
      }

      const url = `/exports/gstr1-json?business_id=${bId}&month=${monthStr}${force ? '&force=true' : ''}`;
      const gstrRes = await api.get(url);

      const payloadData = gstrRes.data?.gstr1_payload || gstrRes.data;
      const warningList = gstrRes.data?.validation_warnings || [];
      const invalidParties = gstrRes.data?.invalid_gstin_parties || [];

      setPayload(payloadData);
      setWarnings(warningList);
      setInvalidGstinParties(invalidParties);

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
        return;
      }

      const fileUri = (FileSystem as any).cacheDirectory + `GSTR1_${monthStr}.json`;
      const jsonString = JSON.stringify(payloadData, null, 2);
      await (FileSystem as any).writeAsStringAsync(fileUri, jsonString);

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: `GSTR-1 ${monthStr}`,
        UTI: 'public.json',
      });
    } catch (err: any) {
      console.log('GSTR1 export error:', err);
      const detail = err.response?.data?.detail;
      if (err.response?.status === 422 && detail) {
        const blockingMsg = typeof detail === 'string'
          ? detail
          : detail.message || 'GSTR-1 generation blocked due to validation issues.';
        const blockingIssues = detail.blocking_issues || [];
        if (blockingIssues.length > 0) {
          const issuesStr = blockingIssues.map((i: any) => `• ${i.detail || i.message}`).join('\n');
          Alert.alert(
            'GSTR-1 Validation Issues',
            `${blockingMsg}\n\n${issuesStr}`,
            [
              { text: 'OK', style: 'cancel' },
              {
                text: 'Export Anyway',
                style: 'destructive',
                onPress: () => fetchJsonAndShare(true),
              },
            ]
          );
        } else {
          Alert.alert('Validation Error', blockingMsg);
        }
      } else {
        showApiError(err, 'Failed to export GSTR-1 JSON.');
      }
    } finally {
      setExporting(false);
    }
  };

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // Calculation totals
  const totalTaxable = invoices.reduce((sum, inv) => sum + Number(inv.taxable_amount || 0), 0);
  const totalCGST = invoices.reduce((sum, inv) => sum + Number(inv.cgst_amount || 0), 0);
  const totalSGST = invoices.reduce((sum, inv) => sum + Number(inv.sgst_amount || 0), 0);
  const totalIGST = invoices.reduce((sum, inv) => sum + Number(inv.igst_amount || 0), 0);

  const nonGstinWarnings = warnings.filter(w => !w.toLowerCase().includes('invalid gstin'));
  const hasBlockingIssues = invalidGstinParties.length > 0 && !bypassGstinBlock;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.replace('/reports')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>GSTR-1 Report</Text>
          <TouchableOpacity onPress={() => fetchJsonAndShare(false)} style={styles.shareBtn} disabled={exporting}>
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="share-social-outline" size={20} color="#fff" />
                <Text style={styles.shareTxt}>Export</Text>
              </>
            )}
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

      <SafeScrollView
        baseBottomPadding={80}
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
        {/* Warning Banner for non-GSTIN warnings */}
        {nonGstinWarnings.length > 0 && showWarnings && (
          <View style={styles.warningBanner}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
              <Ionicons name="warning" size={16} color="#d97706" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>{nonGstinWarnings.length} Compliance Warnings</Text>
                {nonGstinWarnings.slice(0, 3).map((w, idx) => (
                  <Text key={idx} style={styles.warningText}>• {w}</Text>
                ))}
                {nonGstinWarnings.length > 3 && (
                  <Text style={styles.warningText}>and {nonGstinWarnings.length - 3} more warnings...</Text>
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
        ) : hasBlockingIssues ? (
          /* ── Action Required Blocking Screen ── */
          <View style={styles.blockingContainer}>
            <View style={styles.badgeIcon}>
              <Ionicons name="warning" size={28} color="#F97316" />
            </View>
            <Text style={styles.blockingTitle}>Can't generate GSTR-1 report</Text>
            <Text style={styles.blockingSub}>
              {invalidGstinParties.length} {invalidGstinParties.length === 1 ? 'party has' : 'parties have'} an invalid GST number. Fix {invalidGstinParties.length === 1 ? 'it' : 'them'} below to continue.
            </Text>

            <View style={{ width: '100%', gap: 10, marginVertical: 12 }}>
              {invalidGstinParties.map((party) => (
                <View key={party.party_id} style={styles.partyCard}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.partyName}>{party.party_name}</Text>
                      <View style={styles.gstinBadge}>
                        <Text style={styles.gstinBadgeTxt}>{party.gstin}</Text>
                      </View>
                    </View>
                    {party.invoice_numbers && party.invoice_numbers.length > 0 && (
                      <Text style={styles.invoicesTxt}>
                        Invoices: {party.invoice_numbers.join(', ')}
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      setEditingParty(party);
                      setEditGstinInput(party.gstin);
                    }}
                    style={styles.editBtn}
                  >
                    <Ionicons name="pencil" size={13} color="#fff" />
                    <Text style={styles.editBtnTxt}>Edit GSTIN</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={() => fetchJsonAndShare(true)} style={{ marginTop: 8, padding: 8 }} disabled={exporting}>
              <Text style={styles.bypassLinkTxt}>Download anyway (not recommended)</Text>
            </TouchableOpacity>
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
                        <Text style={[styles.tableCellVal, { width: 90 }]}>{inv.invoice_date || (inv as any).date || '—'}</Text>
                        <Text style={[styles.tableCellVal, { width: 140 }]} numberOfLines={1}>{inv.customer_name || inv.customer?.name || 'Walk-in'}</Text>
                        <Text style={[styles.tableCellVal, { width: 120, fontFamily: 'monospace', fontSize: 10 }]}>{(inv as any).gstin || inv.customer_gstin || inv.customer?.gstin || inv.customer?.gst_number || '—'}</Text>
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
      </SafeScrollView>

      {/* ── Inline Edit GSTIN Modal ── */}
      {editingParty && (
        <Modal transparent visible animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalTitle}>Edit GSTIN</Text>
                <TouchableOpacity onPress={() => setEditingParty(null)}>
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 12 }}>
                Update GSTIN for <Text style={{ fontWeight: '700', color: Colors.text }}>{editingParty.party_name}</Text>
              </Text>

              <Text style={styles.inputLabel}>GST Number</Text>
              <TextInput
                value={editGstinInput}
                onChangeText={(text) => setEditGstinInput(text.toUpperCase())}
                maxLength={15}
                placeholder="29ABCDE1234F1Z5"
                autoCapitalize="characters"
                style={styles.textInput}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={() => setEditingParty(null)}
                  style={[styles.modalBtn, { backgroundColor: '#F1F5F9' }]}
                >
                  <Text style={[styles.modalBtnTxt, { color: '#475569' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveGstin}
                  disabled={savingGstin}
                  style={[styles.modalBtn, { backgroundColor: Colors.primary }]}
                >
                  {savingGstin ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.modalBtnTxt, { color: '#fff' }]}>Save GSTIN</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  statLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '500', marginBottom: 4, includeFontPadding: false },
  statValue: { fontSize: 12.5, fontWeight: '700', color: Colors.text },
  detailCard: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, gap: 10 },
  cardHeaderTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  emptyTableTxt: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  tableRowHeader: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 8 },
  tableColHeader: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', paddingHorizontal: 6 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingVertical: 10, alignItems: 'center' },
  tableCellVal: { fontSize: 11, color: Colors.textSecondary, paddingHorizontal: 6 },

  /* ── Blocking Screen & Modal Styles ── */
  blockingContainer: { backgroundColor: '#fff', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 20, alignItems: 'center', marginVertical: 10 },
  badgeIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  blockingTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4, textAlign: 'center' },
  blockingSub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginBottom: 12, lineHeight: 16 },
  partyCard: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partyName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  gstinBadge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  gstinBadgeTxt: { fontSize: 10, fontFamily: 'monospace', color: '#DC2626', fontWeight: '700' },
  invoicesTxt: { fontSize: 11, color: Colors.textMuted },
  editBtn: { backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bypassLinkTxt: { fontSize: 11, color: Colors.textMuted, textDecorationLine: 'underline' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#fff', borderRadius: Radius.md, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  inputLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 6 },
  textInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontFamily: 'monospace', color: Colors.text },
  modalBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  modalBtnTxt: { fontSize: 13, fontWeight: '600' }
});
