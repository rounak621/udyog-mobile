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
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DesignTokens, Radius } from '../../constants/theme';
import { safeBack } from '../../utils/navigation';
import { api, setAuthToken } from '../../services/api';
import { FixedBottomBar, useBottomPadding } from '../../components/ui/SafeLayout';
import {
  expenseService,
  PaymentMode,
  ExpenseCreatePayload,
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
  const [deleting, setDeleting] = useState(false);

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
          if (exp.category) {
            setCategoriesList(prev => {
              const exists = prev.some(c => c.toLowerCase() === exp.category.toLowerCase());
              return exists ? prev : [exp.category, ...prev];
            });
          }
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

  const handleConfirmCustomCategory = () => {
    const trimmed = customCategory.trim();
    if (!trimmed) {
      Alert.alert('Validation Error', 'Please enter a category name.');
      return;
    }
    setCategoriesList(prev => {
      const exists = prev.some(c => c.toLowerCase() === trimmed.toLowerCase());
      return exists ? prev : [trimmed, ...prev];
    });
    setCategory(trimmed);
    setCustomCategory('');
    setShowCustomCatInput(false);
  };

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
        try {
          await expenseService.getCategories(businessId);
        } catch {}
        Alert.alert('Success', 'Expense updated successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await expenseService.createExpense(businessId, payload);
        try {
          await expenseService.getCategories(businessId);
        } catch {}
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

  const handleDelete = () => {
    if (!isEditMode || !params.id) return;
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!businessId || !params.id) return;
            setDeleting(true);
            try {
              await expenseService.deleteExpense(businessId, params.id);
              Alert.alert('Deleted', 'Expense has been deleted.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (err) {
              Alert.alert('Error', getApiErrorMessage(err, 'Failed to delete expense.'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerLoading, { paddingTop: insets.top + 40 }]}>
        <ActivityIndicator size="large" color={DesignTokens.brandOrange} />
        <Text style={styles.loadingText}>Loading expense...</Text>
      </View>
    );
  }

  const bottomPadding = useBottomPadding(20);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: DesignTokens.pageBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => safeBack(router, '/expenses')}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={DesignTokens.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Edit expense' : 'New expense'}
        </Text>
      </View>

      {/* Form Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Amount Card */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Amount *</Text>
          <View style={styles.amountInputWrap}>
            <Text style={styles.rupeeSymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={DesignTokens.lightText}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Date Card */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Date *</Text>
          <TouchableOpacity
            style={styles.datePickerBtn}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={DesignTokens.mutedText} />
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

        {/* Category Card */}
        <View style={styles.card}>
          <View style={styles.catHeaderRow}>
            <Text style={styles.fieldLabel}>Category *</Text>
            <TouchableOpacity
              onPress={() => {
                setShowCustomCatInput(!showCustomCatInput);
                if (!showCustomCatInput) setCustomCategory('');
              }}
              style={styles.toggleCustomBtn}
            >
              <Text style={styles.toggleCustomText}>
                {showCustomCatInput ? 'Standard list' : '+ Add new'}
              </Text>
            </TouchableOpacity>
          </View>

          {showCustomCatInput ? (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                style={[styles.inputField, { flex: 1 }]}
                placeholder="Enter category name..."
                placeholderTextColor={DesignTokens.lightText}
                value={customCategory}
                onChangeText={setCustomCategory}
                onSubmitEditing={handleConfirmCustomCategory}
                returnKeyType="done"
                autoFocus
              />
              <TouchableOpacity
                style={styles.confirmCatBtn}
                onPress={handleConfirmCustomCategory}
              >
                <Text style={styles.confirmCatBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
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

        {/* Payment Mode Card */}
        <View style={styles.card}>
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
                    size={18}
                    color={isSelected ? DesignTokens.brandOrange : DesignTokens.mutedText}
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

        {/* Vendor / Paid To Card */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Paid to / Vendor (Optional)</Text>
          <TextInput
            style={styles.inputField}
            placeholder="e.g. Reliance Fresh, Landlord, Helper"
            placeholderTextColor={DesignTokens.lightText}
            value={vendorName}
            onChangeText={setVendorName}
          />
        </View>

        {/* GST Card */}
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.switchTitle}>GST Bill</Text>
              <Text style={styles.switchSub}>
                Enable if tax invoice or ITC claim is applicable
              </Text>
            </View>
            <Switch
              value={isGstApplicable}
              onValueChange={setIsGstApplicable}
              trackColor={{ false: DesignTokens.lines, true: DesignTokens.brandOrange }}
              thumbColor="#FFFFFF"
            />
          </View>

          {isGstApplicable && (
            <View style={styles.gstInputsBlock}>
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.fieldLabel}>Vendor GSTIN (Optional)</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  placeholderTextColor={DesignTokens.lightText}
                  value={vendorGstin}
                  onChangeText={setVendorGstin}
                  autoCapitalize="characters"
                  maxLength={15}
                />
              </View>

              <View style={{ marginBottom: 12 }}>
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
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>CGST (₹)</Text>
                    <TextInput
                      style={styles.inputField}
                      placeholder="0.00"
                      placeholderTextColor={DesignTokens.lightText}
                      value={cgstAmount}
                      onChangeText={val => {
                        setCgstAmount(val);
                        setSgstAmount(val);
                      }}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>SGST (₹)</Text>
                    <TextInput
                      style={styles.inputField}
                      placeholder="0.00"
                      placeholderTextColor={DesignTokens.lightText}
                      value={sgstAmount}
                      onChangeText={setSgstAmount}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.fieldLabel}>IGST (₹)</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="0.00"
                    placeholderTextColor={DesignTokens.lightText}
                    value={igstAmount}
                    onChangeText={setIgstAmount}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
            </View>
          )}
        </View>

        {/* Notes Card */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Note (Optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Add any extra note or remark..."
            placeholderTextColor={DesignTokens.lightText}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Delete button (Edit mode only) */}
        {isEditMode && (
          <TouchableOpacity
            style={styles.deleteExpenseBtn}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={DesignTokens.errorRed} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={DesignTokens.errorRed} />
                <Text style={styles.deleteExpenseBtnText}>Delete expense</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Sticky Bottom Bar (OUTSIDE ScrollView) */}
      <FixedBottomBar style={styles.stickyBottomBar}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>
              {isEditMode ? 'Update expense' : 'Save expense'}
            </Text>
          )}
        </TouchableOpacity>
      </FixedBottomBar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DesignTokens.pageBackground,
  },
  loadingText: {
    fontSize: 13,
    color: DesignTokens.mutedText,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: DesignTokens.lines,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DesignTokens.ink,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
    padding: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: DesignTokens.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
    borderRadius: Radius.sm,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  rupeeSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: DesignTokens.ink,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: DesignTokens.ink,
    padding: 0,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
    borderRadius: Radius.sm,
    padding: 11,
  },
  datePickerText: {
    fontSize: 14,
    color: DesignTokens.ink,
    fontWeight: '600',
  },
  catHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  toggleCustomBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  toggleCustomText: {
    fontSize: 13,
    fontWeight: '600',
    color: DesignTokens.orangeText,
  },
  inputField: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
    borderRadius: Radius.sm,
    padding: 11,
    fontSize: 14,
    color: DesignTokens.ink,
  },
  confirmCatBtn: {
    backgroundColor: DesignTokens.brandOrange,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCatBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryOptionChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryOptionChipActive: {
    backgroundColor: DesignTokens.orangeTint,
    borderColor: DesignTokens.brandOrange,
  },
  categoryOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: DesignTokens.ink,
  },
  categoryOptionTextActive: {
    color: DesignTokens.orangeText,
    fontWeight: '600',
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
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
  },
  modeBtnActive: {
    backgroundColor: DesignTokens.orangeTint,
    borderColor: DesignTokens.brandOrange,
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: DesignTokens.mutedText,
  },
  modeBtnTextActive: {
    color: DesignTokens.orangeText,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DesignTokens.ink,
  },
  switchSub: {
    fontSize: 11,
    color: DesignTokens.mutedText,
    marginTop: 2,
  },
  gstInputsBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: DesignTokens.lines,
  },
  gstTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gstTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
  },
  gstTypeBtnActive: {
    backgroundColor: DesignTokens.orangeTint,
    borderColor: DesignTokens.brandOrange,
  },
  gstTypeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: DesignTokens.mutedText,
  },
  gstTypeBtnTextActive: {
    color: DesignTokens.orangeText,
    fontWeight: '700',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
    borderRadius: Radius.sm,
    padding: 11,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    color: DesignTokens.ink,
  },
  deleteExpenseBtn: {
    paddingVertical: 12,
    borderRadius: Radius.sm,
    backgroundColor: '#F1F5F9',
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  deleteExpenseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: DesignTokens.errorRed,
  },
  stickyBottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: DesignTokens.lines,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  saveBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: Radius.md,
    backgroundColor: DesignTokens.brandOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
