import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput,
  KeyboardAvoidingView, Platform, Keyboard
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

interface PurchaseBillItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  gst_percent: number;
  amount: number;
  tax_amount: number;
}

interface PurchaseBill {
  id: string;
  supplier_invoice_number: string;
  supplier: {
    id: string;
    name: string;
    gstin?: string | null;
    state?: string | null;
  };
  total_amount: number;
  paid_amount: number;
  subtotal: number;
  tax_amount: number;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  round_off: number;
  payment_status: string;
  bill_date: string;
  items: PurchaseBillItem[];
}

export default function PurchaseBillDetailScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bill, setBill] = useState<PurchaseBill | null>(null);
  const [loading, setLoading] = useState(true);

  // Business state
  const [businessId, setBusinessId] = useState<string>('');

  // Payments states
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE'>('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [androidKeyboardOffset, setAndroidKeyboardOffset] = useState(0);

  const paymentScrollViewRef = useRef<ScrollView>(null);
  const amountInputRef = useRef<TextInput>(null);

  const scrollToAmountInput = () => {
    setTimeout(() => {
      if (amountInputRef.current && paymentScrollViewRef.current) {
        amountInputRef.current.measureLayout(
          paymentScrollViewRef.current as any,
          (x, y) => {
            paymentScrollViewRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
          },
          () => {
            paymentScrollViewRef.current?.scrollTo({ y: 0, animated: true });
          }
        );
      }
    }, 100);
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setAndroidKeyboardOffset(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardOffset(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Revert Modal state
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertPaymentId, setRevertPaymentId] = useState<string | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);

  const loadPayments = async (bId: string) => {
    setPaymentsLoading(true);
    try {
      const res = await api.get(`/supplier-payments/${id}?business_id=${bId}`);
      setPayments(res.data || []);
    } catch (err) {
      console.log('Failed to fetch payments:', err);
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    const loadBill = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const bizRes = await api.get('/businesses/me');
        const bId = bizRes.data.id;
        setBusinessId(bId);
        const res = await api.get(`/purchase-bills/${id}?business_id=${bId}`);
        setBill(res.data);
        await loadPayments(bId);
      } catch (err: any) {
        Alert.alert('Error', 'Failed to load purchase bill details');
        router.back();
      } finally {
        setLoading(false);
      }
    };
    loadBill();
  }, [id]);

  const handleEdit = () => {
    if (!bill) return;
    if (bill.payment_status !== 'UNPAID') {
      Alert.alert(
        'Cannot Edit',
        'This purchase bill is already paid or partially paid and cannot be edited.'
      );
      return;
    }
    router.push(`/purchase-bills/create?id=${bill.id}`);
  };

  const handleDelete = () => {
    if (!bill) return;
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this purchase bill?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              setAuthToken(token);
              const bizRes = await api.get('/businesses/me');
              const bId = bizRes.data.id;
              await api.delete(`/purchase-bills/${bill.id}?business_id=${bId}`);
              Alert.alert('Success', 'Purchase bill deleted successfully');
              router.back();
            } catch (err: any) {
              const errMsg = err.response?.data?.detail || 'Failed to delete purchase bill';
              Alert.alert('Error', errMsg);
            }
          }
        }
      ]
    );
  };

  const openPaymentModal = () => {
    setPaymentMode('CASH');
    setPaymentAmount(String(balanceDue));
    setReferenceNumber('');
    setShowPaymentModal(true);
  };

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

    setConfirmingPayment(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.post(`/supplier-payments/?business_id=${businessId}`, {
        amount: amt,
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: paymentMode,
        reference_number: referenceNumber.trim() || undefined,
        purchase_bill_id: bill?.id,
        supplier_id: bill?.supplier.id,
      });

      setShowPaymentModal(false);
      setPaymentAmount('');
      setReferenceNumber('');

      // Refresh data
      const res = await api.get(`/purchase-bills/${id}?business_id=${businessId}`);
      setBill(res.data);
      await loadPayments(businessId);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to record payment');
    } finally {
      setConfirmingPayment(false);
    }
  };

  const handleRevertPayment = (paymentId: string) => {
    setRevertPaymentId(paymentId);
    setRevertReason('');
    setShowRevertModal(true);
  };

  const handleConfirmRevert = async () => {
    if (!revertPaymentId) return;
    setReverting(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.post(`/supplier-payments/${revertPaymentId}/revert?business_id=${businessId}`, {
        reason: revertReason.trim() || undefined
      });

      setShowRevertModal(false);
      setRevertPaymentId(null);
      setRevertReason('');

      // Refresh data
      const res = await api.get(`/purchase-bills/${id}?business_id=${businessId}`);
      setBill(res.data);
      await loadPayments(businessId);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to revert payment');
    } finally {
      setReverting(false);
    }
  };

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!bill) return null;

  const ps = (bill.payment_status || 'UNPAID').toUpperCase();
  const isPaid = ps === 'PAID';
  const isPartial = ps === 'PARTIAL';
  const balanceDue = Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount || 0));

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Bill Details</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity onPress={handleEdit}>
            <Ionicons name="pencil-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete}>
            <Ionicons name="trash-outline" size={22} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Header */}
        <View style={styles.headerCard}>
          <Text style={styles.supplierName}>{bill.supplier?.name || 'Unknown Supplier'}</Text>
          {bill.supplier?.gstin && <Text style={styles.gstinText}>GSTIN: {bill.supplier.gstin}</Text>}
          <View style={styles.statusRow}>
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
            <Text style={styles.dateText}>
              {new Date(bill.bill_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Invoice Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Invoice Number</Text>
            <Text style={styles.infoValue}>{bill.supplier_invoice_number || 'N/A'}</Text>
          </View>
          {bill.supplier?.state && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Supplier State</Text>
              <Text style={styles.infoValue}>{bill.supplier.state}</Text>
            </View>
          )}
        </View>

        {/* Bill Items */}
        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.itemsCard}>
          {bill.items.map((item, index) => (
            <View key={item.id || index} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemDesc}>{item.description}</Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} {item.gst_percent}% GST · {fmt(item.unit_price)} each
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.itemAmt}>{fmt(item.amount)}</Text>
                {item.tax_amount > 0 && (
                  <Text style={styles.itemTax}>+ {fmt(item.tax_amount)} tax</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{fmt(bill.subtotal)}</Text>
          </View>
          
          {bill.cgst_amount ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>CGST</Text>
              <Text style={styles.summaryValue}>{fmt(bill.cgst_amount)}</Text>
            </View>
          ) : null}

          {bill.sgst_amount ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>SGST</Text>
              <Text style={styles.summaryValue}>{fmt(bill.sgst_amount)}</Text>
            </View>
          ) : null}

          {bill.igst_amount ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>IGST</Text>
              <Text style={styles.summaryValue}>{fmt(bill.igst_amount)}</Text>
            </View>
          ) : null}

          {bill.round_off !== 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Round Off</Text>
              <Text style={styles.summaryValue}>{fmt(bill.round_off)}</Text>
            </View>
          )}

          <View style={[styles.summaryRow, { borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 10, marginTop: 4 }]}>
            <Text style={[styles.summaryLabel, { fontWeight: '700', color: Colors.text }]}>Total Amount</Text>
            <Text style={[styles.summaryValue, { fontWeight: '800', color: Colors.primary, fontSize: 16 }]}>{fmt(bill.total_amount)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Paid Amount</Text>
            <Text style={[styles.summaryValue, { color: Colors.success, fontWeight: '600' }]}>{fmt(bill.paid_amount || 0)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Balance Due</Text>
            <Text style={[styles.summaryValue, { color: balanceDue > 0 ? Colors.danger : Colors.success, fontWeight: '700' }]}>
              {fmt(balanceDue)}
            </Text>
          </View>
        </View>

        {/* Payment History Section */}
        <Text style={styles.sectionTitle}>Payment History</Text>
        <View style={styles.card}>
          {paymentsLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : payments.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ fontSize: 13, color: Colors.textMuted }}>No payments recorded yet</Text>
            </View>
          ) : (
            payments.map((p, index) => {
              const isReverted = !!p.is_reverted;
              const formattedDate = new Date(p.payment_date).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric'
              });
              return (
                <View key={p.id || index} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: index === payments.length - 1 ? 0 : 0.5, borderBottomColor: Colors.border }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[{ fontSize: 14, fontWeight: '700' }, isReverted ? { color: Colors.textMuted, textDecorationLine: 'line-through' } : { color: Colors.success }]}>
                        {fmt(Number(p.amount))}
                      </Text>
                      <View style={{ backgroundColor: '#F1F5F9', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.textSecondary }}>{p.payment_mode}</Text>
                      </View>
                      {isReverted && (
                        <View style={{ backgroundColor: '#FEF2F2', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.danger }}>Reverted</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4 }}>
                      {formattedDate} {p.reference_number ? `· Ref: ${p.reference_number}` : ''}
                    </Text>
                    {isReverted && p.revert_reason && (
                      <Text style={{ fontSize: 11, color: Colors.danger, fontStyle: 'italic', marginTop: 2 }}>
                        Reason: {p.revert_reason}
                      </Text>
                    )}
                  </View>
                  {!isReverted && (
                    <TouchableOpacity
                      onPress={() => handleRevertPayment(p.id)}
                      style={{ padding: 6, borderRadius: 6, borderWidth: 0.5, borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }}
                    >
                      <Ionicons name="reload-outline" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Record Payment Button */}
        {!isPaid && (
          <TouchableOpacity style={styles.paidBtn} onPress={openPaymentModal}>
            <Ionicons name="cash-outline" size={18} color="#fff" />
            <Text style={styles.paidBtnText}>Record Payment</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Record Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
          style={styles.payOverlay}
        >
          <View style={[styles.paySheet, { paddingBottom: 20 + insets.bottom, marginBottom: Platform.OS === 'android' ? androidKeyboardOffset : 0 }]}>
            <View style={styles.paySheetHandle} />
            <View style={styles.payHeader}>
              <Text style={styles.payTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <Text style={styles.paySubtitle}>Configure payment details</Text>

            <ScrollView ref={paymentScrollViewRef} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={styles.inputLabel}>Amount (₹) *</Text>
                  <TextInput
                    ref={amountInputRef}
                    onFocus={scrollToAmountInput}
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    placeholder="Enter amount"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <View>
                  <Text style={styles.inputLabel}>Reference Number (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={referenceNumber}
                    onChangeText={setReferenceNumber}
                    placeholder="e.g. UPI Ref, Cheque No"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

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
            </ScrollView>

            <TouchableOpacity
              style={[styles.payConfirmBtn, { marginTop: 12 }, confirmingPayment && { opacity: 0.7 }]}
              onPress={handleConfirmPayment}
              disabled={confirmingPayment}
            >
              {confirmingPayment ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payConfirmText}>Confirm Payment</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Revert Modal */}
      <Modal
        visible={showRevertModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowRevertModal(false); setRevertReason(''); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Revert Payment</Text>
            <Text style={styles.modalSub}>
              Are you sure you want to revert this payment? This will update the bill's paid amount.
            </Text>

            <Text style={styles.inputLabel}>Reason (Optional)</Text>
            <TextInput
              style={[styles.textInput, { marginBottom: 20 }]}
              value={revertReason}
              onChangeText={setRevertReason}
              placeholder="Enter reason for reverting..."
              placeholderTextColor={Colors.textMuted}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setShowRevertModal(false); setRevertReason(''); }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmRevert}
                disabled={reverting}
                style={styles.modalConfirmBtn}
              >
                {reverting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Revert</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  headerCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border, gap: 4 },
  supplierName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  gstinText: { fontSize: 12, color: Colors.textMuted },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  dateText: { fontSize: 12, color: Colors.textSecondary },
  infoCard: { backgroundColor: Colors.card, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 0.5, borderColor: Colors.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 13, color: Colors.textSecondary },
  infoValue: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginTop: 8, marginLeft: 4 },
  itemsCard: { backgroundColor: Colors.card, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 0.5, borderColor: Colors.border },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  itemDesc: { fontSize: 13, fontWeight: '500', color: Colors.text },
  itemMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  itemAmt: { fontSize: 13, fontWeight: '600', color: Colors.text },
  itemTax: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  summaryCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary },
  summaryValue: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  badge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  paidBadge: { backgroundColor: '#F0FDF4' },
  unpaidBadge: { backgroundColor: '#FFF7ED' },
  partialBadge: { backgroundColor: '#EFF6FF' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  paidText: { color: Colors.success },
  unpaidText: { color: '#EA580C' },
  partialText: { color: '#2563EB' },
  paidBtn: { backgroundColor: Colors.success, borderRadius: Radius.sm, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  paidBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  
  // Payment Modal Sheet
  payOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  paySheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, maxHeight: '85%' },
  paySheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 12 },
  payHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  payTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  paySubtitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  textInput: { height: 40, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 12, fontSize: 13, color: Colors.text, backgroundColor: '#f8fafc' },
  payOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  payOptionSelected: { borderColor: '#F97316', backgroundColor: '#FFF7ED' },
  payIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  payIconWrapSelected: { backgroundColor: '#F97316' },
  payOptionLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A' },
  payOptionLabelSelected: { color: '#C2410C' },
  payRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  payRadioSelected: { borderColor: '#F97316' },
  payRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F97316' },
  payConfirmBtn: { backgroundColor: '#F97316', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4, marginTop: 16 },
  payConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Revert Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: Radius.md, padding: 20, width: '100%', maxWidth: 340, borderWidth: 0.5, borderColor: Colors.border },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  modalSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  modalCancelBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, borderWidth: 0.5, borderColor: Colors.border },
  modalCancelBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  modalConfirmBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: Colors.danger },
  modalConfirmBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' }
});
