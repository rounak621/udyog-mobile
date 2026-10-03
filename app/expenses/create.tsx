import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import {
  expenseService,
  PaymentMode,
  ExpenseCreatePayload,
  ExpenseUpdatePayload,
} from '../../services/expenseService';
import { getApiErrorMessage } from '../../utils/apiError';

const PAYMENT_MODES: { label: string; value: PaymentMode; icon: any }[] = [
  { label: 'Cash', value: 'CASH', icon: 'cash-outline' },
  { label: 'Bank', value: 'BANK', icon: 'business-outline' },
  { label: 'UPI', value: 'UPI', icon: 'phone-portrait-outline' },
  { label: 'Cheque', value: 'CHEQUE', icon: 'document-text-outline' },
];

const DEFAULT_CATEGORIES = [
  'Office Rent',
  'Salaries & Wages',
  'Utilities (Electricity/Water)',
  'Office Supplies & Stationery',
  'Travel & Conveyance',
  'Tea & Refreshments',
  'Marketing & Advertising',
  'Software & Subscriptions',
  'Repairs & Maintenance',
  'Packaging & Delivery',
  'Legal & Professional Fees',
  'Other Expenses',
];

const dateToYmd = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function CreateExpenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const isEditMode = !!params.id;
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  const [businessId, setBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [expenseDate, setExpenseDate] = useState<string>(dateToYmd(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [showCustomCatInput, setShowCustomCatInput] = useState(false);
  const [categoriesList, setCategoriesList] = useState<string[]>(DEFAULT_CATEGORIES);

  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [vendorName, setVendorName] = useState<string>('');

  // GST
  const [isGstApplicable, setIsGstApplicable] = useState(false);
  const [vendorGstin, setVendorGstin] = useState<string>('');
  const [gstType, setGstType] = useState<'intrastate' | 'interstate'>('intrastate');
  const [cgstAmount, setCgstAmount] = useState<string>('');
  const [sgstAmount, setSgstAmount] = useState<string>('');
  const [igstAmount, setIgstAmount] = useState<string>('');

  // Notes
  const [notes, setNotes] = useState<string>('');

  // Load initial data
  useEffect(() => {
    const init = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);

        const bizRes = await api.get('/businesses/me');
        const bId = bizRes.data.id;
        setBusinessId(bId);

        // Fetch categories
        try {
          const cats = await expenseService.getCategories(bId);
          if (cats && cats.length > 0) {
            const merged = Array.from(new Set([...cats, ...DEFAULT_CATEGORIES]));
            setCategoriesList(merged);
          }
        } catch {}

        // If edit mode, load existing expense
        if (isEditMode && params.id) {
          const exp = await expenseService.getExpense(bId, params.id);
          setExpenseDate(exp.date);
          setCategory(exp.category);
          setAmount(String(exp.amount));
          setPaymentMode(exp.payment_mode);
          setVendorName(exp.vendor_name || '');
          setIsGstApplicable(exp.is_gst_applicable);
          setVendorGstin(exp.vendor_gstin || '');
          if (exp.igst_amount && Number(exp.igst_amount) > 0) {
            setGstType('interstate');
            setIgstAmount(String(exp.igst_amount));
          } else {
            setGstType('intrastate');
            setCgstAmount(exp.cgst_amount ? String(exp.cgst_amount) : '');
            setSgstAmount(exp.sgst_amount ? String(exp.sgst_amount) : '');
          }
          setNotes(exp.notes || '');
        }
      } catch (err) {
        console.log('Expense form load error:', err);
        Alert.alert('Error', getApiErrorMessage(err, 'Failed to load expense data.'));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [params.id, isEditMode, getToken]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setExpenseDate(dateToYmd(selectedDate));
    }
  };

  const handleSave = async () => {
    const finalCategory = showCustomCatInput ? customCategory.trim() : category.trim();
    if (!finalCategory) {
      Alert.alert('Validation Error', 'Please select or enter an expense category.');
      return;
    }

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount greater than 0.');
      return;
    }

    if (!expenseDate) {
      Alert.alert('Validation Error', 'Please select a valid expense date.');
      return;
    }

    if (!businessId) {
      Alert.alert('Error', 'Business ID is missing. Please try again.');
      return;
    }

    const payload: ExpenseCreatePayload = {
      date: expenseDate,
      category: finalCategory,
      amount: amtNum,
      payment_mode: paymentMode,
      is_gst_applicable: isGstApplicable,
      vendor_name: vendorName.trim() || null,
      vendor_gstin: isGstApplicable && vendorGstin.trim() ? vendorGstin.trim().toUpperCase() : null,
      cgst_amount:
        isGstApplicable && gstType === 'intrastate' && cgstAmount && !isNaN(parseFloat(cgstAmount))
          ? parseFloat(cgstAmount)
          : null,
      sgst_amount:
        isGstApplicable && gstType === 'intrastate' && sgstAmount && !isNaN(parseFloat(sgstAmount))
          ? parseFloat(sgstAmount)
          : null,
      igst_amount:
        isGstApplicable && gstType === 'interstate' && igstAmount && !isNaN(parseFloat(igstAmount))
          ? parseFloat(igstAmount)
          : null,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      if (isEditMode && params.id) {
        await expenseService.updateExpense(businessId, params.id, payload);
        Alert.alert('Success', 'Expense updated successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await expenseService.createExpense(businessId, payload);
        Alert.alert('Success', 'Expense recorded successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      console.log('Expense save error:', err);
      Alert.alert('Save Failed', getApiErrorMessage(err, 'Failed to save expense.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerLoading, { paddingTop: insets.top + 40 }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading expense...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Topbar */}
      <View style={[styles.topbar, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>
          {isEditMode ? 'Edit Expense' : 'Record Expense'}
        </Text>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Date Selector */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Date *</Text>
          <TouchableOpacity
            style={styles.datePickerBtn}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.datePickerText}>{expenseDate}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={new Date(expenseDate + 'T00:00:00')}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}
        </View>

        {/* Amount */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Amount (₹) *</Text>
          <View style={styles.amountInputWrap}>
            <Text style={styles.rupeeSymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Category */}
        <View style={styles.fieldGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.fieldLabel}>Category *</Text>
            <TouchableOpacity
              onPress={() => {
                setShowCustomCatInput(!showCustomCatInput);
                if (!showCustomCatInput) setCustomCategory('');
              }}
            >
              <Text style={styles.toggleCustomText}>
                {showCustomCatInput ? 'Choose Standard' : '+ Custom Category'}
              </Text>
            </TouchableOpacity>
          </View>

          {showCustomCatInput ? (
            <TextInput
              style={styles.textInput}
              placeholder="Enter custom category name..."
              placeholderTextColor={Colors.textMuted}
              value={customCategory}
              onChangeText={setCustomCategory}
              autoFocus
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {categoriesList.map(cat => {
                const isSelected = category.toLowerCase() === cat.toLowerCase();
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOptionChip,
                      isSelected && styles.categoryOptionChipActive,
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        isSelected && styles.categoryOptionTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Payment Mode */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Payment Mode *</Text>
          <View style={styles.modeRow}>
            {PAYMENT_MODES.map(m => {
              const isSelected = paymentMode === m.value;
              return (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.modeBtn, isSelected && styles.modeBtnActive]}
                  onPress={() => setPaymentMode(m.value)}
                >
                  <Ionicons
                    name={m.icon}
                    size={16}
                    color={isSelected ? Colors.primary : Colors.textMuted}
                  />
                  <Text
                    style={[styles.modeBtnText, isSelected && styles.modeBtnTextActive]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Vendor Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Vendor / Paid To (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Reliance Fresh, Electricity Board"
            placeholderTextColor={Colors.textMuted}
            value={vendorName}
            onChangeText={setVendorName}
          />
        </View>

        {/* GST Toggle */}
        <View style={styles.cardSection}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>GST Applicable</Text>
              <Text style={styles.switchSub}>
                Enable if tax invoice or ITC claim is applicable
              </Text>
            </View>
            <Switch
              value={isGstApplicable}
              onValueChange={setIsGstApplicable}
              trackColor={{ false: '#E2E8F0', true: Colors.primary }}
            />
          </View>

          {isGstApplicable && (
            <View style={styles.gstInputsBlock}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Vendor GSTIN (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  placeholderTextColor={Colors.textMuted}
                  value={vendorGstin}
                  onChangeText={setVendorGstin}
                  autoCapitalize="characters"
                  maxLength={15}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Supply Type</Text>
                <View style={styles.gstTypeRow}>
                  <TouchableOpacity
                    style={[
                      styles.gstTypeBtn,
                      gstType === 'intrastate' && styles.gstTypeBtnActive,
                    ]}
                    onPress={() => setGstType('intrastate')}
                  >
                    <Text
                      style={[
                        styles.gstTypeBtnText,
                        gstType === 'intrastate' && styles.gstTypeBtnTextActive,
                      ]}
                    >
                      Intra-state (CGST + SGST)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.gstTypeBtn,
                      gstType === 'interstate' && styles.gstTypeBtnActive,
                    ]}
                    onPress={() => setGstType('interstate')}
                  >
                    <Text
                      style={[
                        styles.gstTypeBtnText,
                        gstType === 'interstate' && styles.gstTypeBtnTextActive,
                      ]}
                    >
                      Inter-state (IGST)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {gstType === 'intrastate' ? (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>CGST (₹)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textMuted}
                      value={cgstAmount}
                      onChangeText={val => {
                        setCgstAmount(val);
                        setSgstAmount(val); // Match CGST and SGST
                      }}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>SGST (₹)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textMuted}
                      value={sgstAmount}
                      onChangeText={setSgstAmount}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>IGST (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    value={igstAmount}
                    onChangeText={setIgstAmount}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
            </View>
          )}
        </View>



        {/* Notes */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Notes (Optional)</Text>
          <TextInput
            style={[styles.textInput, { height: 75, textAlignVertical: 'top' }]}
            placeholder="Add any extra notes or memo..."
            placeholderTextColor={Colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>
              {isEditMode ? 'Update Expense' : 'Save Expense'}
            </Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  topbar: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  topbarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    padding: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 46,
  },
  datePickerText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 50,
  },
  rupeeSymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  toggleCustomText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
    color: Colors.text,
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  categoryOptionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryOptionChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: Colors.primary,
  },
  categoryOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryOptionTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeBtnActive: {
    backgroundColor: '#FFF7ED',
    borderColor: Colors.primary,
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modeBtnTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  cardSection: {
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  switchSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  gstInputsBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: '#F1F5F9',
  },
  gstTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gstTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.sm,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gstTypeBtnActive: {
    backgroundColor: '#FFF7ED',
    borderColor: Colors.primary,
  },
  gstTypeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  gstTypeBtnTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
