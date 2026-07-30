import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, TextInput,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Spacing, Radius } from '../../../constants/theme';
import { api, setAuthToken } from '../../../services/api';
import { useBusiness } from '../../../context/BusinessContext';

export default function RentalOrderRecordPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { business } = useBusiness();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [showPayDatePicker, setShowPayDatePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const outstandingAmount = order
    ? Math.max(0, parseFloat(order.total_amount) - parseFloat(order.paid_amount))
    : 0;

  const loadOrder = async () => {
    if (!business?.id) return;
    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await api.get(`/rental-orders/${id}?business_id=${business.id}`);
      setOrder(res.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load order details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [business?.id]);

  const handleSavePayment = async () => {
    if (!order || !business?.id) return;
    try {
      setSubmitting(true);
      const token = await getToken();
      setAuthToken(token);

      const amount = paymentAmount.trim() ? parseFloat(paymentAmount) : undefined;

      await api.post(`/rental-orders/${order.id}/mark-paid?business_id=${business.id}`, {
        payment_method: paymentMethod,
        paid_amount: amount,
        payment_date: paymentDate.toISOString().split('T')[0],
        notes: paymentNotes.trim() || null
      });

      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to record payment.');
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
        <Text style={styles.topbarTitle}>Receive Payment</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Outstanding Amount */}
          <View style={styles.outstandingBox}>
            <Text style={styles.outstandingLabel}>Outstanding Amount</Text>
            <Text style={styles.outstandingValue}>
              ₹{outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          {/* Amount to receive */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Payment Amount (₹)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Leave empty for full outstanding"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="numeric"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
          </View>

          {/* Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Payment Date</Text>
            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowPayDatePicker(true)}>
              <Text style={styles.dateSelectorText}>
                {paymentDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
              <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            {showPayDatePicker && (
              <DateTimePicker
                value={paymentDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowPayDatePicker(false);
                  if (date) setPaymentDate(date);
                }}
              />
            )}
          </View>

          {/* Payment Method */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Payment Method</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'].map((method) => {
                const isSelected = paymentMethod === method;
                return (
                  <TouchableOpacity
                    key={method}
                    style={[styles.methodChip, isSelected ? styles.methodChipActive : null]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text style={[styles.methodChipText, isSelected ? styles.methodChipTextActive : null]}>
                      {method.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Payment Notes</Text>
            <TextInput
              style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
              placeholder="e.g. Received by Rounak · UPI ref: 123456"
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              multiline
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[styles.confirmBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSavePayment}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.confirmBtnText}>Record Payment</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { padding: 4, marginRight: 8 },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  outstandingBox: { backgroundColor: '#FFFBEB', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#FDE68A', alignItems: 'center' },
  outstandingLabel: { fontSize: 11, fontWeight: '700', color: '#B45309', textTransform: 'uppercase', letterSpacing: 0.5 },
  outstandingValue: { fontSize: 22, fontWeight: '800', color: '#D97706', marginTop: 2 },
  fieldGroup: { gap: 6 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  textInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, backgroundColor: '#FAFBFD' },
  dateSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FAFBFD' },
  dateSelectorText: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  methodChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#FFF7ED', borderWidth: 0.5, borderColor: '#FED7AA' },
  methodChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  methodChipText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  methodChipTextActive: { color: '#fff' },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8, elevation: 2, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
