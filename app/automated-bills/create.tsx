import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DateTimePicker from '@react-native-community/datetimepicker';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { useBottomPadding } from '../../components/ui/SafeLayout';
import { Colors, Spacing, Radius, UNITS } from '../../constants/theme';
import { GST_RATE_STRINGS } from '../../constants/gst';
import { api, setAuthToken } from '../../services/api';
import {
  recurringBillsService,
  RecurringFrequency,
  CreateRecurringBillPayload,
} from '../../services/recurringBills';
import { showApiError } from '../../utils/apiError';
import { checkIsOnline } from '../../services/network';
import { getPdfViewerHtml } from '../../utils/pdfViewerHtml';
import { useBusiness } from '../../context/BusinessContext';

interface FormLineItem {
  id: string;
  item_id: number | null;
  name: string;
  qty: string;
  rate: string;
  gst_rate: string;
  unit: string;
  discount_percent: string;
  hsn_code?: string;
  description?: string;
  isCustom?: boolean;
}

const FREQUENCIES: { label: string; value: RecurringFrequency }[] = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Daily', value: 'daily' },
];

export default function CreateRecurringBillScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = useBottomPadding(24);
  const { getToken } = useAuth();
  const { business } = useBusiness();
  const params = useLocalSearchParams<{ id?: string; customer_id?: string }>();
  const isEditMode = !!params.id;

  const [businessId, setBusinessId] = useState<string>('');
  const [businessState, setBusinessState] = useState<string>('');
  const [loadingInitial, setLoadingInitial] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  // Customer State
  const [parties, setParties] = useState<any[]>([]);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [partySearch, setPartySearch] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [isInterState, setIsInterState] = useState(false);

  // Scheduling State
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [billingDay, setBillingDay] = useState<number>(1);
  const [billingTime, setBillingTime] = useState<string>('09:00');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [autoSendEnabled, setAutoSendEnabled] = useState(true);
  const [whatsappAutoSend, setWhatsappAutoSend] = useState(true);
  const [notes, setNotes] = useState('');

  // Line Items
  const [itemsCatalog, setItemsCatalog] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState<FormLineItem[]>([
    {
      id: Math.random().toString(),
      item_id: null,
      name: '',
      qty: '1',
      rate: '',
      gst_rate: '18',
      unit: 'PCS',
      discount_percent: '',
      isCustom: false,
    },
  ]);
  const [showItemDropdown, setShowItemDropdown] = useState<string | null>(null);
  const [showUnitPicker, setShowUnitPicker] = useState<string | null>(null);
  const [unitSearch, setUnitSearch] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);

  const filteredUnits = useMemo(() => {
    if (!unitSearch.trim()) return UNITS;
    const q = unitSearch.trim().toLowerCase();
    return UNITS.filter(u => u.toLowerCase().includes(q));
  }, [unitSearch]);

  // Ref to track if initial mount load has completed
  const hasLoadedInitialRef = useRef(false);

  // PDF Preview State (Stateless raw bytes preview)
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedInitialRef.current) {
        hasLoadedInitialRef.current = true;
        loadMasterData(true);
      } else {
        // Refetch master data (parties & items catalog) on refocus so newly created items appear
        loadMasterData(false);
      }
    }, [params.id, business?.id])
  );

  const loadMasterData = async (isInitial = true) => {
    try {
      if (isInitial) setLoadingInitial(isEditMode);
      const token = await getToken();
      setAuthToken(token);

      let bId = business?.id || '';
      let bState = business?.state || '';
      if (!bId) {
        const bizRes = await api.get('/businesses/me');
        bId = bizRes.data?.id || '';
        bState = bizRes.data?.state || '';
      }
      if (!bId) return;
      setBusinessId(bId);
      setBusinessState(bState);

      const [partiesRes, itemsRes] = await Promise.all([
        api.get(`/customers/?business_id=${bId}`),
        api.get(`/items/?business_id=${bId}`),
      ]);

      const loadedParties = Array.isArray(partiesRes.data)
        ? partiesRes.data
        : partiesRes.data?.items || partiesRes.data?.customers || [];
      setParties(loadedParties);
      setItemsCatalog(
        Array.isArray(itemsRes.data)
          ? itemsRes.data
          : itemsRes.data?.items || []
      );

      if (isInitial && params.customer_id) {
        const pre = loadedParties.find((p: any) => String(p.id) === String(params.customer_id));
        if (pre) selectCustomer(pre, bState);
      }

      if (isInitial && isEditMode && params.id) {
        const t = await recurringBillsService.get(bId, params.id);
        setFrequency(t.frequency);
        if (t.billing_day) setBillingDay(t.billing_day);
        if (t.billing_time) setBillingTime(t.billing_time);
        if (t.start_date) setStartDate(t.start_date.split('T')[0]);
        if (t.end_date) setEndDate(t.end_date.split('T')[0]);
        setAutoSendEnabled(!!t.auto_send_enabled);
        if (t.whatsapp_auto_send !== undefined) setWhatsappAutoSend(!!t.whatsapp_auto_send);
        setNotes(t.notes || '');

        const matchedParty = loadedParties.find((p: any) => String(p.id) === String(t.customer_id));
        if (matchedParty) selectCustomer(matchedParty, bState);

        if (t.line_items && t.line_items.length > 0) {
          setLineItems(
            t.line_items.map(item => ({
              id: Math.random().toString(),
              item_id: item.item_id || null,
              name: item.item_name || '',
              qty: String(item.quantity || '1'),
              rate: String(item.rate || ''),
              gst_rate: String(item.gst_rate ?? '18'),
              unit: item.unit || 'PCS',
              discount_percent: item.discount_percent ? String(item.discount_percent) : '',
              hsn_code: item.hsn_code || undefined,
              description: item.description || undefined,
              isCustom: !item.item_id,
            }))
          );
          if (t.line_items.some(i => Number(i.discount_percent) > 0)) {
            setShowDiscount(true);
          }
        }
      }
    } catch (err: any) {
      console.log('Error loading automated bill data:', err);
      if (isInitial) showApiError(err, 'Failed to load master data');
    } finally {
      if (isInitial) setLoadingInitial(false);
    }
  };

  const selectCustomer = (party: any, bState: string) => {
    setSelectedParty(party);
    const partyState = party.state || '';
    const isInter = bState && partyState && bState.toLowerCase().trim() !== partyState.toLowerCase().trim();
    setIsInterState(!!isInter);
    setShowCustomerPicker(false);
    setPartySearch('');
  };

  // Line item manipulation
  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        item_id: null,
        name: '',
        qty: '1',
        rate: '',
        gst_rate: '18',
        unit: 'PCS',
        discount_percent: '',
        isCustom: false,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      Alert.alert('Notice', 'An automated bill must have at least one line item.');
      return;
    }
    setLineItems(prev => prev.filter(l => l.id !== id));
  };

  const updateLineItem = (id: string, field: keyof FormLineItem, value: any) => {
    setLineItems(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const selectCatalogItem = (lineId: string, item: any) => {
    const itemRate = item.rate !== undefined && item.rate !== null
      ? String(item.rate)
      : (item.price !== undefined && item.price !== null ? String(item.price) : '');
    setLineItems(prev =>
      prev.map(l => {
        if (l.id !== lineId) return l;
        return {
          ...l,
          item_id: item.id,
          name: item.name || '',
          rate: itemRate || l.rate,
          gst_rate: item.gst_rate !== null && item.gst_rate !== undefined ? String(item.gst_rate) : l.gst_rate,
          unit: item.unit ? String(item.unit).toUpperCase() : l.unit,
          hsn_code: item.hsn_code || l.hsn_code,
          isCustom: false,
        };
      })
    );
    setShowItemDropdown(null);
  };

  // Synchronous live calculations
  const round2 = (n: number) => Math.round(n * 100) / 100;
  let subtotal = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;

  lineItems.forEach(l => {
    const qty = Number(l.qty) || 0;
    const rate = Number(l.rate) || 0;
    const gstRate = Number(l.gst_rate) || 0;
    const baseAmount = qty * rate;
    const discountPercent = showDiscount ? Number(l.discount_percent) || 0 : 0;
    const discountFactor = 1 - discountPercent / 100;
    const taxable = round2(baseAmount * discountFactor);
    subtotal += taxable;

    if (isInterState) {
      totalIGST += round2(taxable * (gstRate / 100));
    } else {
      const halfRate = gstRate / 2;
      const halfTax = round2(taxable * (halfRate / 100));
      totalCGST += halfTax;
      totalSGST += halfTax;
    }
  });

  const exactTotal = subtotal + totalCGST + totalSGST + totalIGST;
  const roundedTotal = Math.round(exactTotal);
  const roundOff = parseFloat((roundedTotal - exactTotal).toFixed(2));
  const tax = totalCGST + totalSGST + totalIGST;
  const total = roundedTotal;

  // Time handling
  const getBillingTimeDate = () => {
    const d = new Date();
    if (billingTime) {
      const [h, m] = billingTime.split(':');
      d.setHours(parseInt(h, 10) || 9, parseInt(m, 10) || 0, 0, 0);
    }
    return d;
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return '09:00 AM';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${m} ${ampm}`;
  };

  // Stateless PDF Preview via cached bytes
  const handlePreviewPdf = async () => {
    if (!selectedParty?.id) {
      Alert.alert('Customer Required', 'Please select a customer first to preview the invoice PDF.');
      return;
    }

    setGeneratingPdf(true);
    setPdfError(false);
    try {
      const token = await getToken();
      setAuthToken(token);

      const payload = {
        customer_id: selectedParty.id,
        start_date: startDate,
        notes: notes.trim() || null,
        line_items: lineItems.map(l => ({
          item_id: l.item_id || null,
          item_name: l.name.trim() || 'Item',
          quantity: Number(l.qty) || 1,
          rate: Number(l.rate) || 0,
          gst_rate: Number(l.gst_rate) || 0,
          hsn_code: l.hsn_code || null,
          description: l.description || null,
          discount_percent: showDiscount ? Number(l.discount_percent) || 0 : 0,
        })),
      };

      const arrayBuffer = await recurringBillsService.previewPdf(businessId, payload);
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);

      // Save to local cache directory
      const cacheUri = `${(FileSystem as any).cacheDirectory}recurring_preview_${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(cacheUri, b64, { encoding: 'base64' });

      setPreviewBase64(b64);
      setShowPdfPreview(true);
    } catch (err: any) {
      console.log('Error generating recurring preview PDF:', err);
      showApiError(err, 'Could not generate PDF preview');
      setPdfError(true);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Submit Handler
  const handleSave = async () => {
    const isOnline = await checkIsOnline();
    if (!isOnline) {
      Alert.alert('Offline', 'You are currently offline. Please check your internet connection and try again.');
      return;
    }

    if (!selectedParty?.id) {
      Alert.alert('Missing Customer', 'Please select a customer for this automated bill.');
      return;
    }

    const invalidItem = lineItems.find(l => !l.name.trim() || Number(l.rate) < 0 || Number(l.qty) <= 0);
    if (invalidItem) {
      Alert.alert('Invalid Item', 'Please ensure all items have a name, positive quantity, and non-negative rate.');
      return;
    }

    if ((frequency === 'monthly' || frequency === 'quarterly') && (!billingDay || billingDay < 1 || billingDay > 31)) {
      Alert.alert('Invalid Billing Day', 'Please select a billing day between 1 and 31.');
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const payload: CreateRecurringBillPayload = {
        customer_id: selectedParty.id,
        frequency: frequency,
        billing_day: frequency === 'monthly' || frequency === 'quarterly' ? billingDay : null,
        billing_time: billingTime.trim() || '09:00',
        start_date: startDate,
        end_date: endDate.trim() ? endDate : null,
        auto_send_enabled: autoSendEnabled,
        whatsapp_auto_send: whatsappAutoSend,
        notes: notes.trim() ? notes.trim().slice(0, 300) : null,
        line_items: lineItems.map(l => ({
          item_id: l.item_id || null,
          item_name: l.name.trim(),
          quantity: Number(l.qty) || 1,
          rate: Number(l.rate) || 0,
          gst_rate: Number(l.gst_rate) || 0,
          hsn_code: l.hsn_code || null,
          description: l.description || null,
          discount_percent: showDiscount ? Number(l.discount_percent) || 0 : 0,
        })),
      };

      if (isEditMode && params.id) {
        await recurringBillsService.update(businessId, params.id, payload);
        Alert.alert('Success', 'Automated bill template updated successfully', [
          { text: 'OK', onPress: () => router.replace(`/automated-bills/${params.id}`) },
        ]);
      } else {
        const created = await recurringBillsService.create(businessId, payload);
        router.replace(`/automated-bills/${created.id}`);
      }
    } catch (err: any) {
      console.log('Save automated bill error:', err);
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error' || (err.isAxiosError && !err.response)) {
        Alert.alert('Network Error', 'Network error — your automated bill was not saved, please try again.');
      } else {
        showApiError(err, `Failed to ${isEditMode ? 'update' : 'create'} automated bill`);
      }
    } finally {
      setSaving(false);
    }
  };

  const filteredParties = parties.filter(p =>
    (p.name || '').toLowerCase().includes(partySearch.toLowerCase().trim())
  );

  const getInitials = (name?: string) =>
    name
      ?.split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';

  if (loadingInitial) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 12, color: Colors.textSecondary }}>Loading template...</Text>
      </View>
    );
  }

  const pdfViewerHtml = previewBase64 ? getPdfViewerHtml(`data:application/pdf;base64,${previewBase64}`) : '';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Top Header */}
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>{isEditMode ? 'Edit Automated Bill' : 'New Automated Bill'}</Text>
          <Text style={styles.subTitle}>Scheduled Recurring Invoice</Text>
        </View>
        <TouchableOpacity style={styles.saveHeaderBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.saveHeaderBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPadding + 80 }}
        enableOnAndroid={true}
        extraScrollHeight={150}
        keyboardShouldPersistTaps="handled"
      >
        {/* Customer Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>CUSTOMER</Text>
          <TouchableOpacity style={styles.card} onPress={() => setShowCustomerPicker(true)}>
            {selectedParty ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.customerAvatarText}>{getInitials(selectedParty.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardMainText}>{selectedParty.name}</Text>
                  {selectedParty.gstin ? (
                    <Text style={styles.cardSubText}>GSTIN: {selectedParty.gstin}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: Colors.textMuted, fontSize: 14 }}>Select customer...</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Scheduling Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>SCHEDULE SETTINGS</Text>
          <View style={styles.card}>
            {/* Frequency Selection Pills */}
            <Text style={styles.fieldLabel}>FREQUENCY</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {FREQUENCIES.map(f => {
                const active = frequency === f.value;
                return (
                  <TouchableOpacity
                    key={f.value}
                    style={[styles.freqPill, active && styles.freqPillActive]}
                    onPress={() => setFrequency(f.value)}
                  >
                    <Text style={[styles.freqPillText, active && styles.freqPillTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Billing Day (Monthly or Quarterly only) */}
            {(frequency === 'monthly' || frequency === 'quarterly') && (
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.fieldLabel}>DAY OF MONTH ({billingDay})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                    const active = billingDay === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.dayPill, active && styles.dayPillActive]}
                        onPress={() => setBillingDay(d)}
                      >
                        <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Billing Time Picker */}
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.fieldLabel}>RUN TIME</Text>
              <TouchableOpacity
                style={styles.timePickerBtn}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={18} color={Colors.primary} />
                <Text style={styles.timePickerText}>{formatDisplayTime(billingTime)}</Text>
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={getBillingTimeDate()}
                  mode="time"
                  is24Hour={false}
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowTimePicker(false);
                    if (selectedDate) {
                      const h = String(selectedDate.getHours()).padStart(2, '0');
                      const m = String(selectedDate.getMinutes()).padStart(2, '0');
                      setBillingTime(`${h}:${m}`);
                    }
                  }}
                />
              )}
            </View>

            {/* Start Date & End Date Row */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>START DATE *</Text>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Text style={styles.datePickerText}>
                    {new Date(startDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                  <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                {showStartDatePicker && (
                  <DateTimePicker
                    value={new Date(startDate)}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowStartDatePicker(false);
                      if (selectedDate) setStartDate(selectedDate.toISOString().split('T')[0]);
                    }}
                  />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>END DATE (OPTIONAL)</Text>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={[styles.datePickerText, !endDate && { color: Colors.textMuted }]}>
                    {endDate
                      ? new Date(endDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'No End Date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                {showEndDatePicker && (
                  <DateTimePicker
                    value={endDate ? new Date(endDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowEndDatePicker(false);
                      if (selectedDate) setEndDate(selectedDate.toISOString().split('T')[0]);
                    }}
                  />
                )}
              </View>
            </View>

            {/* WhatsApp Auto-send toggle */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 0.5, borderTopColor: Colors.border }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text }}>Auto-Send via WhatsApp</Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>Automatically send invoice PDF to customer's WhatsApp on generation</Text>
              </View>
              <Switch
                value={whatsappAutoSend}
                onValueChange={setWhatsappAutoSend}
                trackColor={{ false: '#E2E8F0', true: '#FED7AA' }}
                thumbColor={whatsappAutoSend ? Colors.primary : '#94A3B8'}
              />
            </View>

            {/* In-app notification toggle */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, marginTop: 8, borderTopWidth: 0.5, borderTopColor: Colors.border }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text }}>In-App Generation Alerts</Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>Receive in-app notification when each bill is generated</Text>
              </View>
              <Switch
                value={autoSendEnabled}
                onValueChange={setAutoSendEnabled}
                trackColor={{ false: '#E2E8F0', true: '#FED7AA' }}
                thumbColor={autoSendEnabled ? Colors.primary : '#94A3B8'}
              />
            </View>
          </View>
        </View>

        {/* Line Items Section */}
        <View style={styles.sectionContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.sectionHeader}>TEMPLATE ITEMS ({lineItems.length})</Text>
            <TouchableOpacity onPress={() => setShowDiscount(!showDiscount)}>
              <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '600' }}>
                {showDiscount ? 'Hide Discount' : '+ Add Discount'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {lineItems.map((item, index) => {
              const itemRate = Number(item.rate) || 0;
              const itemQty = Number(item.qty) || 0;
              const itemGst = Number(item.gst_rate) || 0;
              const itemDisc = showDiscount ? Number(item.discount_percent) || 0 : 0;
              const itemBase = itemQty * itemRate;
              const itemTaxable = itemBase * (1 - itemDisc / 100);
              const itemTotal = itemTaxable * (1 + itemGst / 100);

              return (
                <View key={item.id}>
                  {index > 0 && <View style={styles.itemDivider} />}
                  <View style={{ gap: 10 }}>
                    {/* Item Name Row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {item.isCustom ? (
                        <View style={styles.customInputContainer}>
                          <TextInput
                            style={styles.customTextInput}
                            placeholder="Type item name..."
                            placeholderTextColor={Colors.textMuted}
                            value={item.name}
                            onChangeText={val => updateLineItem(item.id, 'name', val)}
                          />
                          <TouchableOpacity
                            onPress={() => {
                              updateLineItem(item.id, 'isCustom', false);
                              updateLineItem(item.id, 'name', '');
                              updateLineItem(item.id, 'item_id', null);
                            }}
                          >
                            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.itemSelectBtn}
                          onPress={() => setShowItemDropdown(item.id)}
                        >
                          <Text
                            style={[styles.itemSelectBtnText, !item.name && { color: Colors.textMuted }]}
                            numberOfLines={1}
                          >
                            {item.name || 'Select item...'}
                          </Text>
                          <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity onPress={() => removeLineItem(item.id)} style={styles.removeBtn}>
                        <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>

                    {/* HSN Code Input */}
                    <View>
                      <TextInput
                        key={`item_hsn_${item.id}`}
                        style={styles.itemInput}
                        placeholder="HSN Code (optional)"
                        placeholderTextColor={Colors.textMuted}
                        value={item.hsn_code || ''}
                        onChangeText={val => updateLineItem(item.id, 'hsn_code', val)}
                        keyboardType="numeric"
                        autoCapitalize="characters"
                      />
                    </View>

                    {/* Variant / Description Input */}
                    <View>
                      <TextInput
                        key={`item_desc_${item.id}`}
                        style={styles.itemInput}
                        placeholder="Variant / Description (optional)"
                        placeholderTextColor={Colors.textMuted}
                        value={item.description || ''}
                        onChangeText={val => updateLineItem(item.id, 'description', val)}
                      />
                    </View>

                    {/* Rate, Qty, Unit Row */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1.2 }}>
                        <Text style={styles.miniLabel}>RATE (₹)</Text>
                        <TextInput
                          style={styles.itemInput}
                          placeholder="0.00"
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="numeric"
                          value={item.rate}
                          onChangeText={val => updateLineItem(item.id, 'rate', val)}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.miniLabel}>QTY</Text>
                        <TextInput
                          style={styles.itemInput}
                          placeholder="1"
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="numeric"
                          value={item.qty}
                          onChangeText={val => updateLineItem(item.id, 'qty', val)}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.miniLabel}>UNIT</Text>
                        <TouchableOpacity
                          style={styles.unitSelectBtn}
                          onPress={() => setShowUnitPicker(item.id)}
                        >
                          <Text style={styles.unitSelectBtnText} numberOfLines={1}>
                            {item.unit || 'PCS'}
                          </Text>
                          <Ionicons name="chevron-down" size={12} color={Colors.textMuted} />
                        </TouchableOpacity>
                      </View>

                      {showDiscount && (
                        <View style={{ flex: 1 }}>
                          <Text style={styles.miniLabel}>DISC %</Text>
                          <TextInput
                            style={styles.itemInput}
                            placeholder="0"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="numeric"
                            value={item.discount_percent}
                            onChangeText={val => updateLineItem(item.id, 'discount_percent', val)}
                          />
                        </View>
                      )}
                    </View>

                    {/* GST Rate Selection */}
                    <View>
                      <Text style={styles.miniLabel}>GST RATE (%)</Text>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        {GST_RATE_STRINGS.map(rateStr => {
                          const active = String(item.gst_rate) === rateStr;
                          return (
                            <TouchableOpacity
                              key={rateStr}
                              style={[styles.gstPill, active && styles.gstPillActive]}
                              onPress={() => updateLineItem(item.id, 'gst_rate', rateStr)}
                            >
                              <Text style={[styles.gstPillText, active && styles.gstPillTextActive]}>
                                {rateStr}%
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Line Total */}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                      <Text style={styles.lineTotalText}>
                        Total: ₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={styles.addItemBtn} onPress={addLineItem}>
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={styles.addItemBtnText}>Add Another Item</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Card */}
        <View style={styles.sectionContainer}>
          <View style={[styles.card, styles.summaryCard]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Taxable Subtotal</Text>
              <Text style={styles.summaryValue}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>

            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>GST</Text>
                <Text style={styles.summarySub}>{isInterState ? 'IGST (Inter-State)' : 'CGST + SGST (Intra-State)'}</Text>
              </View>
              <Text style={styles.summaryValue}>₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>

            {roundOff !== 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Round Off</Text>
                <Text style={styles.summaryValue}>₹{roundOff.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.summaryDivider} />

            <View style={styles.summaryTotalRow}>
              <View>
                <Text style={styles.totalTitle}>Est. Invoice Total</Text>
                <Text style={styles.totalSub}>Per recurring billing run</Text>
              </View>
              <Text style={styles.totalAmountText}>₹{total.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </View>

        {/* Notes (300 chars max) */}
        <View style={styles.sectionContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={styles.sectionHeader}>NOTES (OPTIONAL)</Text>
            <Text style={styles.charCountText}>{notes.length}/300</Text>
          </View>
          <View style={styles.card}>
            <TextInput
              style={styles.textArea}
              placeholder="e.g. Monthly subscription maintenance retainer..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={300}
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </View>

        {/* Stateless PDF Preview Action Button */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <TouchableOpacity
            style={styles.previewBtn}
            onPress={handlePreviewPdf}
            disabled={generatingPdf}
          >
            {generatingPdf ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
                <Text style={styles.previewBtnText}>Preview Generated Invoice PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isEditMode ? 'Save Template Changes' : 'Create Automated Bill Template'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>

      {/* Customer Picker Modal */}
      <Modal
        visible={showCustomerPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCustomerPicker(false);
          setPartySearch('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCustomerPicker(false);
                  setPartySearch('');
                }}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search customers..."
                placeholderTextColor={Colors.textMuted}
                value={partySearch}
                onChangeText={setPartySearch}
                autoFocus
              />
            </View>

            <FlatList
              data={filteredParties}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalPartyItem} onPress={() => selectCustomer(item, businessState)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalPartyName}>{item.name}</Text>
                    {item.gstin ? <Text style={styles.modalPartySub}>GSTIN: {item.gstin}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Item Catalog Dropdown */}
      {showItemDropdown && (
        <Modal
          visible={!!showItemDropdown}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowItemDropdown(null)}
        >
          <View style={styles.dropdownOverlay}>
            <View style={styles.dropdownContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose Item</Text>
                <TouchableOpacity onPress={() => setShowItemDropdown(null)}>
                  <Ionicons name="close" size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.customItemChoice}
                onPress={() => {
                  const lineId = showItemDropdown;
                  setShowItemDropdown(null);
                  updateLineItem(lineId, 'isCustom', true);
                  updateLineItem(lineId, 'item_id', null);
                  updateLineItem(lineId, 'name', '');
                }}
              >
                <Ionicons name="create-outline" size={20} color={Colors.primary} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.primary }}>
                  Type Custom Item Name
                </Text>
              </TouchableOpacity>

              <FlatList
                data={itemsCatalog}
                keyExtractor={item => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.catalogItemRow}
                    onPress={() => selectCatalogItem(showItemDropdown, item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catalogItemName}>{item.name}</Text>
                      <Text style={styles.catalogItemSub}>
                        Rate: ₹{item.rate ?? item.price ?? 0} · GST: {item.gst_rate || 0}%
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 13 }}>No catalog items found.</Text>
                  </View>
                }
                ListFooterComponent={
                  <TouchableOpacity
                    style={styles.addNewItemBtn}
                    onPress={() => {
                      setShowItemDropdown(null);
                      router.push('/items/create');
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                    <Text style={styles.addNewItemBtnText}>+ Add New Item</Text>
                  </TouchableOpacity>
                }
              />

              {/* Add New Item */}
              <TouchableOpacity
                style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}
                onPress={() => { setShowItemDropdown(null); router.push('/items/create' as any); }}
              >
                <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.primary, flexShrink: 1 }}>Add New Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Unit Picker Modal */}
      {showUnitPicker && (
        <Modal
          visible={!!showUnitPicker}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowUnitPicker(null);
            setUnitSearch('');
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={[styles.modalContent, { height: '55%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Unit</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowUnitPicker(null);
                    setUnitSearch('');
                  }}
                >
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>

              {/* Search Box */}
              <View style={styles.modalSearchBox}>
                <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search unit (e.g. PCS, KGS)..."
                  placeholderTextColor={Colors.textMuted}
                  value={unitSearch}
                  onChangeText={setUnitSearch}
                  autoCapitalize="characters"
                />
                {unitSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setUnitSearch('')}>
                    <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                style={{ flex: 1 }}
                data={filteredUnits}
                keyExtractor={u => u}
                renderItem={({ item: unitOption }) => {
                  const activeLine = lineItems.find(l => l.id === showUnitPicker);
                  const isSelected = (activeLine?.unit || 'PCS').toUpperCase() === unitOption;
                  return (
                    <TouchableOpacity
                      style={styles.modalItem}
                      onPress={() => {
                        if (showUnitPicker) {
                          updateLineItem(showUnitPicker, 'unit', unitOption);
                        }
                        setShowUnitPicker(null);
                        setUnitSearch('');
                      }}
                    >
                      <Text style={[styles.modalItemName, isSelected && { color: Colors.primary, fontWeight: '700' }]}>
                        {unitOption}
                      </Text>
                      {isSelected && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 13 }}>No matching units found.</Text>
                  </View>
                }
                keyboardShouldPersistTaps="handled"
              />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* PDF Preview Modal — Preview only, NO download button per web spec */}
      <Modal
        visible={showPdfPreview}
        animationType="slide"
        onRequestClose={() => setShowPdfPreview(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={[styles.pdfHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setShowPdfPreview(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.pdfHeaderTitle} numberOfLines={1}>
              Preview Template Invoice
            </Text>
            {/* Explicitly no download button in preview mode */}
            <View style={{ width: 36 }} />
          </View>

          <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {previewBase64 && !pdfError && (
              <WebView
                source={{ html: pdfViewerHtml }}
                style={{ flex: 1 }}
                originWhitelist={['*']}
                javaScriptEnabled={true}
                onError={() => setPdfError(true)}
              />
            )}

            {pdfError && (
              <View style={styles.centerContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
                <Text style={{ marginTop: 12, fontSize: 15, fontWeight: '700', color: Colors.text }}>
                  Could not load preview
                </Text>
                <Text style={{ marginTop: 6, fontSize: 13, color: Colors.textMuted, textAlign: 'center' }}>
                  Please try again or proceed to save the template.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  subTitle: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  saveHeaderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: '#FFF7ED',
  },
  saveHeaderBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  sectionContainer: { marginHorizontal: 16, marginTop: 14 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 2,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  cardMainText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  cardSubText: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', marginBottom: 6 },
  freqPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  freqPillActive: { backgroundColor: '#FFF7ED', borderColor: Colors.primary },
  freqPillText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  freqPillTextActive: { color: Colors.primary },
  dayPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayPillText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  dayPillTextActive: { color: '#fff' },
  timePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  timePickerText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  datePickerText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  itemDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 },
  customInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingRight: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  customTextInput: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: Colors.text },
  itemSelectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  itemSelectBtnText: { fontSize: 13, fontWeight: '500', color: Colors.text },
  removeBtn: { padding: 6 },
  miniLabel: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', marginBottom: 2 },
  itemInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.text,
    borderWidth: 0.5,
    borderColor: Colors.border,
    textAlign: 'center',
  },
  gstPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gstPillActive: { backgroundColor: '#FFF7ED', borderColor: Colors.primary },
  gstPillText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  gstPillTextActive: { color: Colors.primary },
  lineTotalText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  addItemBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  summaryCard: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: '#92400E' },
  summarySub: { fontSize: 10, color: '#B45309', marginTop: 1 },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#92400E' },
  summaryDivider: { height: 1, backgroundColor: '#FED7AA', marginVertical: 10 },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  totalTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  totalSub: { fontSize: 10, color: '#92400E' },
  totalAmountText: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  charCountText: { fontSize: 11, color: Colors.textMuted },
  textArea: {
    fontSize: 13,
    color: Colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
    padding: 0,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: Radius.md,
    paddingVertical: 12,
  },
  previewBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: '80%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    margin: 12,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  modalSearchInput: { flex: 1, fontSize: 13, color: Colors.text, paddingVertical: 0 },
  modalPartyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  modalPartyName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  modalPartySub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dropdownContent: {
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  customItemChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#FFF7ED',
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
  },
  catalogItemRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  catalogItemName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  catalogItemSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  addNewItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    backgroundColor: '#FFF7ED',
  },
  addNewItemBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  unitSelectBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  unitSelectBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  modalItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  pdfHeader: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  pdfHeaderTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
});
