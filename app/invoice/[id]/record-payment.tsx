import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FixedBottomBar } from '../../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../../constants/theme';
import { api, setAuthToken } from '../../../services/api';
import { getApiErrorMessage } from '../../../utils/apiError';

type PaymentSource = 'DIRECT' | 'ADVANCE' | 'SPLIT';

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash', icon: 'cash-outline' },
  { value: 'BANK', label: 'Bank Transfer', icon: 'business-outline' },
  { value: 'UPI', label: 'UPI', icon: 'phone-portrait-outline' },
  { value: 'CHEQUE', label: 'Cheque', icon: 'document-text-outline' },
  { value: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal-outline' },
] as const;

export default function InvoiceRecordPaymentScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [availableAdvance, setAvailableAdvance] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  // Selected payment source: DIRECT (Cash/UPI/Bank), ADVANCE (from customer advance), or SPLIT
  const [paymentSource, setPaymentSource] = useState<PaymentSource>(
    (source === 'ADVANCE' || source === 'SPLIT') ? source : 'DIRECT'
  );

  // Direct Payment state
  const [directAmount, setDirectAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK' | 'UPI' | 'CHEQUE' | 'OTHER'>('CASH');
  const [directNotes, setDirectNotes] = useState<string>('');

  // Advance Payment state
  const [advanceAmount, setAdvanceAmount] = useState<string>('');
  const [advanceNotes, setAdvanceNotes] = useState<string>('');

  // Split Payment state
  const [splitAdvanceAmount, setSplitAdvanceAmount] = useState<string>('');
  const [splitDirectAmount, setSplitDirectAmount] = useState<string>('');
  const [splitDate, setSplitDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [splitMode, setSplitMode] = useState<'CASH' | 'BANK' | 'UPI' | 'CHEQUE' | 'OTHER'>('CASH');
  const [splitNotes, setSplitNotes] = useState<string>('');

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const balanceDue = invoice ? Math.max(0, Number(invoice.total_amount) - Number(invoice.paid_amount || 0)) : 0;
  const hasAdvance = availableAdvance > 0;
  const maxApplicableAdvance = Math.min(availableAdvance, balanceDue);

  const loadInvoice = async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await api.get(`/invoices/${id}`);
      const invData = res.data;
      setInvoice(invData);

      const bal = Math.max(0, Number(invData.total_amount) - Number(invData.paid_amount || 0));
      setDirectAmount(bal > 0 ? bal.toFixed(2) : '');

      // Live customer advance balance
      if (invData.customer_id) {
        try {
          const advRes = await api.get(`/payments/customer/${invData.customer_id}/advance-balance?business_id=${invData.business_id}`);
          const adv = Number(advRes.data?.available_advance || 0);
          setAvailableAdvance(adv);

          const maxAdv = Math.min(adv, bal);
          setAdvanceAmount(maxAdv > 0 ? maxAdv.toFixed(2) : '');
          setSplitAdvanceAmount(maxAdv > 0 ? maxAdv.toFixed(2) : '');
          const defaultSplitDirect = Math.max(0, bal - maxAdv);
          setSplitDirectAmount(defaultSplitDirect > 0 ? defaultSplitDirect.toFixed(2) : '0.00');

          if (source === 'ADVANCE' && adv > 0) {
            setPaymentSource('ADVANCE');
          }
        } catch (advErr) {
          console.log('Error fetching customer advance balance:', advErr);
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load invoice details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, []);

  const handleSplitAdvanceChange = (val: string) => {
    setSplitAdvanceAmount(val);
    const advNum = parseFloat(val) || 0;
    const rem = Math.max(0, balanceDue - advNum);
    setSplitDirectAmount(rem > 0 ? rem.toFixed(2) : '0.00');
  };

  const handleConfirmPayment = async () => {
    try {
      setSubmitting(true);
      const token = await getToken();
      setAuthToken(token);

      if (paymentSource === 'DIRECT') {
        const amt = parseFloat(directAmount);
        if (isNaN(amt) || amt <= 0) {
          Alert.alert('Error', 'Please enter a valid positive payment amount.');
          setSubmitting(false);
          return;
        }
        if (amt > balanceDue + 0.01) {
          Alert.alert('Error', `Amount cannot exceed invoice balance due of ${fmt(balanceDue)}`);
          setSubmitting(false);
          return;
        }

        await api.post(`/payments/receive?business_id=${invoice.business_id}`, {
          party_id: invoice.customer_id,
          amount: amt,
          payment_date: paymentDate,
          payment_mode: paymentMode,
          notes: directNotes.trim() || null,
          allocations: [
            {
              invoice_id: Number(invoice.id),
              amount: amt,
            },
          ],
        });

        router.back();
      } else if (paymentSource === 'ADVANCE') {
        const amt = parseFloat(advanceAmount);
        if (isNaN(amt) || amt <= 0) {
          Alert.alert('Error', 'Please enter a valid positive advance amount to apply.');
          setSubmitting(false);
          return;
        }
        if (amt > availableAdvance + 0.01) {
          Alert.alert('Error', `Amount exceeds customer's available advance (${fmt(availableAdvance)})`);
          setSubmitting(false);
          return;
        }
        if (amt > balanceDue + 0.01) {
          Alert.alert('Error', `Amount exceeds invoice balance due (${fmt(balanceDue)})`);
          setSubmitting(false);
          return;
        }

        await api.post(`/payments/apply-advance?business_id=${invoice.business_id}`, {
          invoice_id: Number(invoice.id),
          amount: amt,
          notes: advanceNotes.trim() || null,
        });

        router.back();
      } else if (paymentSource === 'SPLIT') {
        const numAdv = parseFloat(splitAdvanceAmount);
        const numDirect = parseFloat(splitDirectAmount);

        if (isNaN(numAdv) || numAdv <= 0) {
          Alert.alert('Error', 'Please enter a valid advance amount to apply.');
          setSubmitting(false);
          return;
        }
        if (numAdv > availableAdvance + 0.01) {
          Alert.alert('Error', `Advance portion exceeds available advance (${fmt(availableAdvance)})`);
          setSubmitting(false);
          return;
        }
        if (isNaN(numDirect) || numDirect <= 0) {
          Alert.alert('Error', 'Please enter a valid direct payment amount.');
          setSubmitting(false);
          return;
        }
        if (numAdv + numDirect > balanceDue + 0.01) {
          Alert.alert('Error', `Combined total (${fmt(numAdv + numDirect)}) exceeds invoice balance due (${fmt(balanceDue)})`);
          setSubmitting(false);
          return;
        }

        // Step 1: Apply Advance
        await api.post(`/payments/apply-advance?business_id=${invoice.business_id}`, {
          invoice_id: Number(invoice.id),
          amount: numAdv,
          notes: splitNotes.trim() ? `[Split Advance] ${splitNotes.trim()}` : null,
        });

        // Step 2: Record Direct Payment for remainder
        try {
          await api.post(`/payments/receive?business_id=${invoice.business_id}`, {
            party_id: invoice.customer_id,
            amount: numDirect,
            payment_date: splitDate,
            payment_mode: splitMode,
            notes: splitNotes.trim() ? `[Split Remainder] ${splitNotes.trim()}` : null,
            allocations: [
              {
                invoice_id: Number(invoice.id),
                amount: numDirect,
              },
            ],
          });
          router.back();
        } catch (splitErr: any) {
          const errMsg = getApiErrorMessage(splitErr, 'Direct payment portion failed.');
          Alert.alert('Partial Success', `Advance applied successfully, but recording direct payment failed: ${errMsg}`);
          router.back();
        }
      }
    } catch (err: any) {
      Alert.alert('Error', getApiErrorMessage(err, 'Failed to record payment'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Record Payment</Text>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ ...styles.content, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={40}
      >
        {/* Invoice Summary Card */}
        <View style={styles.summaryCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.invoiceNum}>{invoice?.invoice_number}</Text>
              <Text style={styles.partyName}>{invoice?.party_name || invoice?.customer_name || 'Unknown Party'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.balanceLabel}>Balance Due</Text>
              <Text style={styles.balanceValue}>{fmt(balanceDue)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Source Selector (Shown only when available advance > 0, matching web PaymentModal) */}
        {hasAdvance && (
          <View style={styles.sourceSelectorRow}>
            <TouchableOpacity
              style={[styles.sourceTab, paymentSource === 'DIRECT' && styles.sourceTabActive]}
              onPress={() => setPaymentSource('DIRECT')}
            >
              <Ionicons name="card-outline" size={15} color={paymentSource === 'DIRECT' ? '#0F172A' : '#64748B'} />
              <Text style={[styles.sourceTabText, paymentSource === 'DIRECT' && styles.sourceTabTextActive]}>Direct</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sourceTab, paymentSource === 'ADVANCE' && styles.sourceTabActive]}
              onPress={() => setPaymentSource('ADVANCE')}
            >
              <Ionicons name="wallet-outline" size={15} color={paymentSource === 'ADVANCE' ? '#C2410C' : '#64748B'} />
              <Text style={[styles.sourceTabText, paymentSource === 'ADVANCE' && { color: '#C2410C', fontWeight: '700' }]}>From Advance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sourceTab, paymentSource === 'SPLIT' && styles.sourceTabActive]}
              onPress={() => setPaymentSource('SPLIT')}
            >
              <Ionicons name="layers-outline" size={15} color={paymentSource === 'SPLIT' ? '#0F172A' : '#64748B'} />
              <Text style={[styles.sourceTabText, paymentSource === 'SPLIT' && styles.sourceTabTextActive]}>Split</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ TAB 1: DIRECT PAYMENT ═══ */}
        {paymentSource === 'DIRECT' && (
          <View style={{ gap: 14 }}>
            {/* Amount Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Amount (₹) *</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={directAmount}
                onChangeText={setDirectAmount}
                placeholder="Enter amount"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Date Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Payment Date *</Text>
              <TextInput
                style={styles.textInput}
                value={paymentDate}
                onChangeText={setPaymentDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Notes Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={directNotes}
                onChangeText={setDirectNotes}
                placeholder="Add payment notes..."
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Payment Mode */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Payment Mode</Text>
              <View style={{ gap: 8 }}>
                {PAYMENT_MODES.map(opt => {
                  const selected = paymentMode === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setPaymentMode(opt.value)}
                      style={[styles.payOption, selected && styles.payOptionSelected]}
                    >
                      <View style={[styles.payIconWrap, selected && styles.payIconWrapSelected]}>
                        <Ionicons name={opt.icon as any} size={20} color={selected ? '#fff' : '#F97316'} />
                      </View>
                      <Text style={[styles.payOptionLabel, selected && styles.payOptionLabelSelected]}>
                        {opt.label}
                      </Text>
                      <View style={[styles.payRadio, selected && styles.payRadioSelected]}>
                        {selected ? <View style={styles.payRadioDot} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ═══ TAB 2: PAY FROM ADVANCE ═══ */}
        {paymentSource === 'ADVANCE' && (
          <View style={{ gap: 14 }}>
            {/* Available Advance Info Box */}
            <View style={styles.advanceInfoBox}>
              <View>
                <Text style={styles.advanceInfoBoxLabel}>AVAILABLE ADVANCE</Text>
                <Text style={styles.advanceInfoBoxVal}>{fmt(availableAdvance)}</Text>
              </View>
              {maxApplicableAdvance > 0 && (
                <TouchableOpacity
                  onPress={() => setAdvanceAmount(maxApplicableAdvance.toFixed(2))}
                  style={styles.useMaxBtn}
                >
                  <Text style={styles.useMaxBtnText}>Use Max ({fmt(maxApplicableAdvance)})</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Amount to Apply */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Amount to Apply from Advance (₹) *</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={advanceAmount}
                onChangeText={setAdvanceAmount}
                placeholder={maxApplicableAdvance.toFixed(2)}
                placeholderTextColor={Colors.textMuted}
              />
              {balanceDue > maxApplicableAdvance && (
                <Text style={styles.partialNoteText}>
                  Note: Advance will partially cover this bill. Remaining {fmt(Math.max(0, balanceDue - (parseFloat(advanceAmount) || 0)))} can be paid separately.
                </Text>
              )}
            </View>

            {/* Notes Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                multiline
                value={advanceNotes}
                onChangeText={setAdvanceNotes}
                placeholder="e.g. Drawn down against upfront advance"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
        )}

        {/* ═══ TAB 3: SPLIT PAYMENT ═══ */}
        {paymentSource === 'SPLIT' && (
          <View style={{ gap: 14 }}>
            {/* Split Info Strip */}
            <View style={styles.advanceInfoBox}>
              <View>
                <Text style={styles.advanceInfoBoxLabel}>AVAILABLE ADVANCE</Text>
                <Text style={styles.advanceInfoBoxVal}>{fmt(availableAdvance)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.advanceInfoBoxLabel}>BILL DUE</Text>
                <Text style={[styles.advanceInfoBoxVal, { color: Colors.danger }]}>{fmt(balanceDue)}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>From Advance (₹) *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={splitAdvanceAmount}
                  onChangeText={handleSplitAdvanceChange}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Direct Portion (₹) *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={splitDirectAmount}
                  onChangeText={setSplitDirectAmount}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            {/* Direct Portion Date */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Direct Portion Date *</Text>
              <TextInput
                style={styles.textInput}
                value={splitDate}
                onChangeText={setSplitDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Notes Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={splitNotes}
                onChangeText={setSplitNotes}
                placeholder="Add notes for split payment..."
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Direct Portion Mode */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Direct Payment Mode</Text>
              <View style={{ gap: 8 }}>
                {PAYMENT_MODES.map(opt => {
                  const selected = splitMode === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setSplitMode(opt.value)}
                      style={[styles.payOption, selected && styles.payOptionSelected]}
                    >
                      <View style={[styles.payIconWrap, selected && styles.payIconWrapSelected]}>
                        <Ionicons name={opt.icon as any} size={20} color={selected ? '#fff' : '#F97316'} />
                      </View>
                      <Text style={[styles.payOptionLabel, selected && styles.payOptionLabelSelected]}>
                        {opt.label}
                      </Text>
                      <View style={[styles.payRadio, selected && styles.payRadioSelected]}>
                        {selected ? <View style={styles.payRadioDot} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* Fixed Footer Bar */}
      <FixedBottomBar style={styles.footerBar}>
        <TouchableOpacity
          style={[styles.confirmBtn, submitting && { opacity: 0.7 }]}
          onPress={handleConfirmPayment}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmBtnText}>
              {paymentSource === 'ADVANCE'
                ? 'Apply Advance'
                : paymentSource === 'SPLIT'
                ? 'Confirm Split Payment'
                : 'Confirm Payment'}
            </Text>
          )}
        </TouchableOpacity>
      </FixedBottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { padding: 4, marginRight: 8 },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { padding: 16, gap: 16 },
  summaryCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  invoiceNum: { fontSize: 15, fontWeight: '600', color: Colors.text },
  partyName: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  balanceLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  balanceValue: { fontSize: 18, fontWeight: '700', color: Colors.danger, marginTop: 2 },
  
  // Segmented source selector (Direct / From Advance / Split)
  sourceSelectorRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4 },
  sourceTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
  sourceTabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  sourceTabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  sourceTabTextActive: { color: '#0F172A', fontWeight: '700' },

  // Advance info card
  advanceInfoBox: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: Radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  advanceInfoBoxLabel: { fontSize: 10, fontWeight: '700', color: '#9A3412', letterSpacing: 0.5 },
  advanceInfoBoxVal: { fontSize: 18, fontWeight: '800', color: '#EA580C', marginTop: 2 },
  useMaxBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#FED7AA', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  useMaxBtnText: { fontSize: 11, fontWeight: '700', color: '#C2410C' },
  partialNoteText: { fontSize: 11, color: '#B45309', marginTop: 4, lineHeight: 15 },

  fieldGroup: { gap: 6 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  textInput: { height: 44, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 12, fontSize: 14, color: Colors.text, backgroundColor: '#f8fafc' },
  payOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  payOptionSelected: { borderColor: '#F97316', backgroundColor: '#FFF7ED' },
  payIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  payIconWrapSelected: { backgroundColor: '#F97316' },
  payOptionLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A' },
  payOptionLabelSelected: { color: '#C2410C' },
  payRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  payRadioSelected: { borderColor: '#F97316' },
  payRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F97316' },
  footerBar: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  confirmBtn: { backgroundColor: '#F97316', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
