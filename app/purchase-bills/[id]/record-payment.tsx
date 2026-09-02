import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FixedBottomBar } from '../../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../../constants/theme';
import { api, setAuthToken } from '../../../services/api';

export default function PurchaseBillRecordPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState<any>(null);
  const [businessId, setBusinessId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE'>('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const balanceDue = bill ? Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount || 0)) : 0;

  const loadBill = async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      setBusinessId(bId);
      const res = await api.get(`/purchase-bills/${id}?business_id=${bId}`);
      setBill(res.data);
      const bal = Math.max(0, Number(res.data.total_amount) - Number(res.data.paid_amount || 0));
      setPaymentAmount(String(bal));
    } catch (err) {
      Alert.alert('Error', 'Failed to load purchase bill details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBill();
  }, []);

  const handleConfirmPayment = async () => {
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (amt > balanceDue) {
      Alert.alert('Error', `Amount cannot exceed remaining balance of ${fmt(balanceDue)}`);
      return;
    }

    try {
      setSubmitting(true);
      const token = await getToken();
      setAuthToken(token);
      await api.post(`/supplier-payments/?business_id=${businessId}`, {
        amount: amt,
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: paymentMode,
        reference_number: referenceNumber.trim() || undefined,
        purchase_bill_id: bill?.id,
        supplier_id: bill?.supplier?.id,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to record payment');
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
          contentContainerStyle={[styles.content, { paddingBottom: 20 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          enableOnAndroid={true}
          extraScrollHeight={40}
        >
          {/* Bill Summary Card */}
          <View style={styles.summaryCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.billNum}>{bill?.bill_number}</Text>
                <Text style={styles.partyName}>{bill?.supplier?.name || 'Unknown Supplier'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.balanceLabel}>Balance Due</Text>
                <Text style={styles.balanceValue}>{fmt(balanceDue)}</Text>
              </View>
            </View>
          </View>

          {/* Amount Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Amount (₹) *</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              placeholder="Enter amount"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Reference Number Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Reference Number (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              placeholder="e.g. UPI Ref, Cheque No"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Payment Mode */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Payment Mode</Text>
            <View style={{ gap: 8 }}>
              {([
                { value: 'CASH', label: 'Cash', icon: 'cash-outline' },
                { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: 'business-outline' },
                { value: 'UPI', label: 'UPI', icon: 'phone-portrait-outline' },
                { value: 'CHEQUE', label: 'Cheque', icon: 'document-text-outline' },
              ] as const).map(opt => {
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
            <Text style={styles.confirmBtnText}>Confirm Payment</Text>
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
  billNum: { fontSize: 15, fontWeight: '600', color: Colors.text },
  partyName: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  balanceLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  balanceValue: { fontSize: 18, fontWeight: '700', color: Colors.danger, marginTop: 2 },
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
