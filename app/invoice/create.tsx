import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Modal, FlatList, Animated, Easing, Linking,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { GST_RATE_STRINGS } from '../../constants/gst';
import { api, setAuthToken, API_BASE_URL } from '../../services/api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { savePdfToAndroidOrShare } from '../../services/safHelper';
import { WebView } from 'react-native-webview';
import { getPdfViewerHtml } from '../../utils/pdfViewerHtml';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Audio } from 'expo-av';
import { useBottomPadding } from '../../components/ui/SafeLayout';
import { checkIsOnline } from '../../services/network';

interface LineItem {
  id: string;
  item_id: any;
  name: string;
  qty: string;
  rate: string;
  gst_rate: string;
  unit: string;
  discount_percent: string;
  isCustom?: boolean;
}

export default function CreateInvoiceScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ customer_id?: string; party_id?: string; maya_data?: string; id?: string }>();
  const isEditMode = !!params.id;
  const preselectCustomerId = params.customer_id || params.party_id;
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessState, setBusinessState] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);
  const [dualAddressEnabled, setDualAddressEnabled] = useState(false);
  const [isInterState, setIsInterState] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoicePrefix, setInvoicePrefix] = useState<string>('');
  const [showPatternHint, setShowPatternHint] = useState<boolean>(false);
  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [partySearch, setPartySearch] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: Math.random().toString(), item_id: null, name: '', qty: '1', rate: '', gst_rate: '18', unit: 'PCS', discount_percent: '', isCustom: false }
  ]);
  const [notes, setNotes] = useState('');
  const [consignmentAddress, setConsignmentAddress] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Invoice type state
  const [invoiceType, setInvoiceType] = useState<'INVOICE' | 'NONGST' | 'SERVICE'>('INVOICE');
  const [isGstApplicable, setIsGstApplicable] = useState(true);

  // Customer picker modal state
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // Item picker state
  const [itemSearch, setItemSearch] = useState<Record<string, string>>({});
  const [showItemDropdown, setShowItemDropdown] = useState<string | null>(null);

  // Success modal actions states
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (showPdfPreview) {
      setWebViewLoading(true);
      setHasError(false);
    }
  }, [showPdfPreview]);

  // Animation refs for success modal checkmark
  const circleScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0.4)).current;

  const scrollViewRef = useRef<any>(null);
  const itemPositions = useRef<{ [key: string]: number }>({});
  const lineItemsSectionY = useRef(0);

  // Helper aliases to match mockup JSX names perfectly (moved below definitions)

  const loadData = async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      setBusinessId(bId);
      setBusinessState(bizRes.data.state || '');
      setShowDiscount(!!bizRes.data.show_discount);
      setDualAddressEnabled(!!bizRes.data.dual_address_enabled);
      
      const [custRes, itemRes] = await Promise.allSettled([
        api.get(`/customers/?business_id=${bId}&limit=100`),
        api.get(`/items/?business_id=${bId}&limit=100`),
      ]);
      
      let partiesList: any[] = [];
      if (custRes.status === 'fulfilled') {
        const data = custRes.value.data;
        partiesList = Array.isArray(data) ? data : data.items || data.customers || [];
        setParties(partiesList);
      }
      if (itemRes.status === 'fulfilled') {
        const data = itemRes.value.data;
        setItems(Array.isArray(data) ? data : data.items || []);
      }

      if (isEditMode) {
        const invRes = await api.get(`/invoices/${params.id}`);
        const invData = invRes.data;
        setInvoiceNumber(invData.invoice_number);
        setInvoiceDate(invData.invoice_date);
        setInvoiceType(invData.invoice_type || 'INVOICE');
        setNotes(invData.notes || '');
        setConsignmentAddress(invData.consignment_address || '');
        setShowDiscount(!!invData.show_discount);
        setIsGstApplicable(invData.is_gst_applicable !== false);

        const custId = invData.customer_id;
        const match = partiesList.find(p => String(p.id) === String(custId));
        if (match) {
          setSelectedParty(match);
          const customerState = match.state || '';
          const interState = bizRes.data.state && customerState && bizRes.data.state.toLowerCase().trim() !== customerState.toLowerCase().trim();
          setIsInterState(!!interState);
        }

        if (invData.line_items) {
          const mapped = invData.line_items.map((li: any) => ({
            id: String(li.id || Math.random()),
            item_id: li.item_id,
            name: li.item_name || li.item?.name || '',
            qty: String(li.quantity),
            rate: String(li.rate),
            gst_rate: String(li.gst_rate),
            unit: li.unit || 'PCS',
            discount_percent: String(li.discount_percent || 0),
            isCustom: !li.item_id
          }));
          setLineItems(mapped);
        }
      }
    } catch (err) {
      console.log('Load error:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch next invoice number when invoiceType or businessId changes (single source of truth)
  useEffect(() => {
    if (businessId && !isEditMode) {
      api.get(`/invoices/next-number?business_id=${businessId}&invoice_type=${invoiceType}`)
        .then(res => {
          const num = String(res.data.invoice_number || res.data.next_number || '');
          setInvoiceNumber(num);
          if (res.data.prefix) {
            setInvoicePrefix(res.data.prefix);
          }
          setShowPatternHint(false);
        })
        .catch(() => {});
    }
  }, [invoiceType, businessId]);

  // Pre-select customer if customer_id was passed in route params
  useEffect(() => {
    if (preselectCustomerId && parties.length > 0 && !selectedParty) {
      const match = parties.find(p => String(p.id) === String(preselectCustomerId));
      if (match) {
        setSelectedParty(match);
        setConsignmentAddress(match.consignment_address || match.address || '');
        const customerState = match.state || '';
        const interState = businessState && customerState && businessState.toLowerCase().trim() !== customerState.toLowerCase().trim();
        setIsInterState(!!interState);
      }
    }
  }, [preselectCustomerId, parties, businessState]);

  // Pre-fill from Maya draft data if maya_data was passed in route params
  useEffect(() => {
    if (!params.maya_data || parties.length === 0) return;
    try {
      const draft = JSON.parse(params.maya_data as string);
      // Match customer by name
      if (draft.customer_name && !selectedParty) {
        const match = parties.find(
          (p: any) => p.name?.toLowerCase().trim() === draft.customer_name.toLowerCase().trim()
        );
        if (match) {
          setSelectedParty(match);
          const customerState = match.state || '';
          const interState = businessState && customerState && businessState.toLowerCase().trim() !== customerState.toLowerCase().trim();
          setIsInterState(!!interState);
        }
      }
      // Pre-fill line items
      if (draft.items && draft.items.length > 0) {
        const newLineItems: LineItem[] = draft.items.map((di: any) => {
          // Try to match against existing items catalog by name
          const catalogMatch = items.find(
            (it: any) => it.name?.toLowerCase().trim() === (di.name || '').toLowerCase().trim()
          );
          return {
            id: Math.random().toString(),
            item_id: catalogMatch?.id || di.item_id || null,
            name: di.name || '',
            qty: String(di.qty || di.quantity || 1),
            rate: String(di.rate || di.unit_price || catalogMatch?.price || ''),
            gst_rate: String(di.tax_rate || di.gst_rate || catalogMatch?.gst_rate || '18'),
            unit: di.unit || catalogMatch?.unit || 'PCS',
            discount_percent: '0',
            isCustom: !catalogMatch,
          };
        });
        setLineItems(newLineItems);
      }
      // Pre-fill invoice date
      if (draft.invoice_date) {
        setInvoiceDate(draft.invoice_date);
      }
    } catch (err) {
      console.log('Maya data parse error:', err);
    }
  }, [params.maya_data, parties, items, businessState]);

  // Animate success checkmark (Google Pay-style: circle scales in, then check draws).
  // Tuned to complete in under ~500ms total.
  useEffect(() => {
    if (showSuccess) {
      circleScale.setValue(0);
      checkOpacity.setValue(0);
      checkScale.setValue(0.4);
      Animated.sequence([
        Animated.spring(circleScale, {
          toValue: 1,
          tension: 150,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(checkOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(checkScale, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.back(1.6)),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [showSuccess]);

  const filteredParties = parties.filter(p => p.name?.toLowerCase().includes(partySearch.toLowerCase()));

  const addLineItem = () => {
    const newId = Math.random().toString();
    setLineItems(prev => [...prev, { id: newId, item_id: null, name: '', qty: '1', rate: '', gst_rate: '18', unit: 'PCS', discount_percent: '', isCustom: false }]);
    setTimeout(() => {
      const y = itemPositions.current[newId];
      if (typeof y === 'number' && scrollViewRef.current) {
        scrollViewRef.current.scrollToPosition(0, Math.max(0, lineItemsSectionY.current + y - 150), true);
      }
    }, 200);
  };
  const removeLineItem = (id: string) => setLineItems(prev => prev.filter(l => l.id !== id));
  const updateLineItem = useCallback((id: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }, []);

  // Calculations
  const round2 = (n: number) => Math.round(n * 100) / 100;

  let subtotal = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;

  lineItems.forEach(l => {
    const qty = Number(l.qty) || 0;
    const rate = Number(l.rate) || 0;
    const gstRate = (invoiceType === 'NONGST' || (invoiceType === 'SERVICE' && !isGstApplicable)) ? 0 : (Number(l.gst_rate) || 0);
    const baseAmount = qty * rate;
    const discountPercent = showDiscount ? (Number(l.discount_percent) || 0) : 0;
    const discountFactor = 1 - (discountPercent / 100);
    const taxable = round2(baseAmount * discountFactor);
    subtotal += taxable;
    if (isInterState) {
      totalIGST += round2(taxable * (gstRate / 100));
    } else {
      const halfRate = gstRate / 2;
      const halfTaxAmt = round2(taxable * (halfRate / 100));
      totalCGST += halfTaxAmt;
      totalSGST += halfTaxAmt;
    }
  });

  const exactTotal = subtotal + totalCGST + totalSGST + totalIGST;
  const roundedTotal = Math.round(exactTotal);
  const roundOff = parseFloat((roundedTotal - exactTotal).toFixed(2));
  const tax = totalCGST + totalSGST + totalIGST; // keep existing `tax` variable for anywhere else in the file that references it
  const total = roundedTotal; // this becomes the new authoritative preview total

  const playSuccessSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/buttons/sounds/button-09a.mp3' },
        { shouldPlay: true, volume: 0.5 }
      );
      setTimeout(() => sound.unloadAsync(), 2000);
    } catch {}
  };

  const shareInvoicePDF = async (mode: 'whatsapp' | 'download') => {
    if (!createdInvoice?.share_token) return;
    try {
      const pdfUrl = `${API_BASE_URL}/public/invoice/${createdInvoice.share_token}/pdf`;

      if (mode === 'download') {
        const customerName = (selectedCustomer?.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
        const invoiceNum = (createdInvoice?.invoice_number || 'invoice').replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `${customerName}_${invoiceNum}.pdf`;
        const fileUri = (FileSystem as any).cacheDirectory + fileName;
        const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);
        if (downloadResult.status === 200) {
          await savePdfToAndroidOrShare(downloadResult.uri, fileName, `Save ${fileName}`);
        } else {
          throw new Error('Download failed');
        }
      } else {
        const fileUri = (FileSystem as any).cacheDirectory + `invoice_${createdInvoice.invoice_number?.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);
        if (downloadResult.status === 200) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Invoice ${createdInvoice.invoice_number}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          throw new Error('Share failed');
        }
      }
    } catch (err) {
      console.log('Share error:', err);
      Alert.alert('Error', 'Could not share PDF. Please try again.');
    }
  };

  const handleInvoiceNumberChange = (value: string) => {
    setInvoiceNumber(value);
    if (value && invoicePrefix && !value.startsWith(invoicePrefix)) {
      setShowPatternHint(true);
    } else {
      setShowPatternHint(false);
    }
  };

  const handleSave = async () => {
    if (!selectedParty) { Alert.alert('Error', 'Please select a customer'); return; }
    if (lineItems.some(i => !i.name || !i.rate)) { Alert.alert('Error', 'Please fill all item details'); return; }

    const isOnline = await checkIsOnline();
    if (!isOnline) {
      Alert.alert('Network Error', 'Network error — your invoice was not saved, please try again.');
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      
      const payload: any = {
        customer_id: selectedParty?.id || null,
        invoice_date: invoiceDate,
        line_items: lineItems.map(l => ({
          item_id: l.item_id || null,
          item_name: l.name,
          quantity: Number(l.qty) || 1,
          rate: Number(l.rate) || 0,
          gst_rate: (invoiceType === 'NONGST' || (invoiceType === 'SERVICE' && !isGstApplicable)) ? 0 : Number(l.gst_rate) || 0,
          discount_percent: showDiscount ? (Number(l.discount_percent) || 0) : 0,
        })),
        consignment_address: dualAddressEnabled ? (consignmentAddress.trim() || undefined) : undefined,
        is_gst_applicable: invoiceType === 'SERVICE' ? isGstApplicable : true,
      };

      if (!isEditMode) {
        payload.invoice_type = invoiceType;
        payload.status = 'ISSUED';
        payload.notes = notes || undefined;
        payload.show_discount = showDiscount || false;
        payload.requested_invoice_number = invoiceNumber.trim() || undefined;
      }
      
      if (isEditMode) {
        await api.put(`/invoices/${params.id}?business_id=${businessId}`, payload);
        Alert.alert('Success', 'Invoice updated successfully', [
          { text: 'OK', onPress: () => router.replace(`/invoice/${params.id}`) }
        ]);
      } else {
        const res = await api.post(`/invoices/?business_id=${businessId}`, payload);
        const invoiceData = res.data?.invoice || res.data;
        setCreatedInvoice(invoiceData);
        setShowSuccess(true);
        playSuccessSound();
      }
    } catch (err: any) {
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error' || (err.isAxiosError && !err.response)) {
        Alert.alert('Network Error', 'Network error — your invoice was not saved, please try again.');
      } else {
        Alert.alert('Error', err.response?.data?.detail || `Failed to ${isEditMode ? 'update' : 'create'} invoice`);
      }
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'CS';
    return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  // Helper aliases to match mockup JSX names perfectly
  const selectedCustomer = selectedParty;
  const addItem = addLineItem;
  const removeItem = removeLineItem;
  const updateItem = updateLineItem;
  const handleSubmit = handleSave;

  const previewPdfUrl = createdInvoice?.share_token
    ? `${API_BASE_URL}/public/invoice/${createdInvoice.share_token}/pdf?mode=inline`
    : '';
  const pdfViewerHtml = previewPdfUrl ? getPdfViewerHtml(previewPdfUrl) : '';

  const bottomPadding = useBottomPadding(100);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Invoice' : 'New Invoice'}</Text>
          <Text style={styles.headerSub}>{isEditMode ? `Editing Invoice #${invoiceNumber}` : 'Draft · auto-saved'}</Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#F97316" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        enableOnAndroid={true}
        extraScrollHeight={150}
        keyboardShouldPersistTaps="handled"
      >
        {/* Invoice type toggle */}
        <View style={[styles.typeToggle, isEditMode && { opacity: 0.6 }]}>
          {[
            { label: 'GST Invoice', value: 'INVOICE' },
            { label: 'Non-GST', value: 'NONGST' },
            { label: 'Service', value: 'SERVICE' }
          ].map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.typeBtn, invoiceType === t.value && styles.typeBtnActive]}
              onPress={() => !isEditMode && setInvoiceType(t.value as any)}
              disabled={isEditMode}
            >
              <Text style={[styles.typeBtnText, invoiceType === t.value && styles.typeBtnTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {invoiceType === 'SERVICE' && (
          <View style={[styles.typeToggle, { marginTop: 0, marginHorizontal: 28, backgroundColor: '#E2E8F0', opacity: isEditMode ? 0.6 : 1 }]}>
            {[
              { label: 'GST Service', value: true },
              { label: 'Non-GST Service', value: false }
            ].map(t => (
              <TouchableOpacity
                key={String(t.value)}
                style={[styles.typeBtn, isGstApplicable === t.value && styles.typeBtnActive]}
                onPress={() => !isEditMode && setIsGstApplicable(t.value)}
                disabled={isEditMode}
              >
                <Text style={[styles.typeBtnText, isGstApplicable === t.value && styles.typeBtnTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Invoice No + Date row (side by side) */}
        <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 }}>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.cardLabel}>INVOICE NO.</Text>
            <TextInput
              style={[styles.cardValue, { padding: 0, marginTop: 2 }, isEditMode && { color: '#64748B' }]}
              value={invoiceNumber}
              onChangeText={handleInvoiceNumberChange}
              editable={!isEditMode}
              placeholder="Auto-generating..."
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
            />
            {showPatternHint && !isEditMode && (
              <Text style={{ fontSize: 10, color: '#F97316', marginTop: 4, fontWeight: '500' }}>
                💡 Pattern mismatch from default ({invoicePrefix})
              </Text>
            )}
          </View>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.cardLabel}>DATE</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', flexShrink: 1 }} textBreakStrategy="simple">
                {invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select date'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color="#94A3B8" />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={invoiceDate ? new Date(invoiceDate) : new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setInvoiceDate(selectedDate.toISOString().split('T')[0]);
                  }
                }}
              />
            )}
          </View>
        </View>

        {/* Bill To */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={styles.sectionLabel}>BILL TO</Text>
          <TouchableOpacity style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]} onPress={() => setShowCustomerPicker(true)}>
            {selectedCustomer ? (
              <>
                <View style={styles.customerAvatar}>
                  <Text style={styles.customerAvatarText}>{getInitials(selectedCustomer.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardValue}>{selectedCustomer.name}</Text>
                  {selectedCustomer.gstin && <Text style={styles.customerGstin}>GSTIN {selectedCustomer.gstin}</Text>}
                </View>
              </>
            ) : (
              <Text style={{ color: '#94A3B8', fontSize: 14, flex: 1 }}>Select customer...</Text>
            )}
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Shipping / Consignee Address (conditional on dual_address_enabled) */}
        {dualAddressEnabled && (
          <View style={[styles.card, { marginHorizontal: 16, marginBottom: 16 }]}>
            <Text style={styles.cardLabel}>SHIPPING ADDRESS (OPTIONAL)</Text>
            <TextInput
              style={[styles.itemInput, { height: 60, textAlignVertical: 'top', minWidth: '100%', textAlign: 'left', paddingHorizontal: 10, paddingVertical: 6 }]}
              multiline
              placeholder="Enter consignee / shipping address..."
              placeholderTextColor="#94A3B8"
              value={consignmentAddress}
              onChangeText={setConsignmentAddress}
            />
          </View>
        )}

        {/* Items Section */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }} onLayout={(e) => { lineItemsSectionY.current = e.nativeEvent.layout.y; }}>
          <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>ITEMS · {lineItems.length}</Text>
          <View style={styles.card}>
            {lineItems.map((item, index) => (
              <View key={item.id} onLayout={(e) => { itemPositions.current[item.id] = e.nativeEvent.layout.y; }}>
                {index > 0 && <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 }} />}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* Item name: Select button or Custom TextInput */}
                  <View style={{ flex: 1 }}>
                    {item.isCustom ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 8, paddingRight: 12 }}>
                        <TextInput
                          key={`item_name_${item.id}`}
                          blurOnSubmit={false}
                          style={{ flex: 1, padding: 12, minHeight: 44, fontSize: 14, fontWeight: '600', color: '#0F172A' }}
                          placeholder="Type item name..."
                          placeholderTextColor="#94A3B8"
                          value={item.name}
                          onChangeText={t => updateItem(item.id, 'name', t)}
                          autoFocus
                        />
                        <TouchableOpacity onPress={() => {
                          updateItem(item.id, 'isCustom', false);
                          updateItem(item.id, 'name', '');
                          updateItem(item.id, 'item_id', null);
                        }}>
                          <Ionicons name="close-circle" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                    ) : item.name ? (
                      <TouchableOpacity
                        style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                        onPress={() => {
                          setItemSearch(prev => ({ ...prev, [item.id]: '' }));
                          setShowItemDropdown(item.id);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A' }} numberOfLines={1}>{item.name}</Text>
                          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            ₹{item.rate} · {item.gst_rate}% GST
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="pencil-outline" size={16} color="#F97316" />
                          <Text style={{ fontSize: 11, color: '#F97316', fontWeight: '600', marginLeft: 4 }}>Change</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, minHeight: 44, justifyContent: 'center' }}
                        onPress={() => setShowItemDropdown(item.id)}
                      >
                        <Text style={{ fontSize: 14, color: '#94A3B8', fontWeight: '400' }}>
                          Select item...
                        </Text>
                      </TouchableOpacity>
                    )}
                    {showItemDropdown === item.id && (
                      <View style={{ backgroundColor: '#fff', borderRadius: 8, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, maxHeight: 250, marginTop: 8 }}>
                        <ScrollView nestedScrollEnabled style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled">
                          {/* Custom Item option */}
                          <TouchableOpacity
                            style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFF7ED' }}
                            onPress={() => {
                              updateItem(item.id, 'isCustom', true);
                              updateItem(item.id, 'name', '');
                              updateItem(item.id, 'item_id', null);
                              setShowItemDropdown(null);
                            }}
                          >
                            <Ionicons name="create-outline" size={18} color="#F97316" />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#F97316', flexShrink: 1 }} textBreakStrategy="simple">Custom Item</Text>
                          </TouchableOpacity>
                          {/* Existing items list */}
                          {items.filter(i => i.name?.toLowerCase().includes((itemSearch[item.id] || '').toLowerCase())).map(prod => (
                            <TouchableOpacity
                              key={String(prod.id)}
                              style={{ padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' }}
                              onPress={() => {
                                setLineItems(prev => prev.map(l => l.id === item.id ? {
                                  ...l,
                                  name: prod.name,
                                  item_id: prod.id,
                                  rate: String(prod.rate || prod.price || ''),
                                  gst_rate: String(prod.gst_rate || '18'),
                                  isCustom: false,
                                } : l));
                                setItemSearch(prev => ({ ...prev, [item.id]: prod.name }));
                                setShowItemDropdown(null);
                              }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>{prod.name}</Text>
                              <Text style={{ fontSize: 11, color: '#64748B' }}>₹{prod.rate || prod.price} · {prod.gst_rate}% GST</Text>
                            </TouchableOpacity>
                          ))}
                          {/* Add New Item */}
                          <TouchableOpacity
                            style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}
                            onPress={() => { setShowItemDropdown(null); router.push('/items/create' as any); }}
                          >
                            <Ionicons name="add-circle-outline" size={18} color="#F97316" />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#F97316', flexShrink: 1 }} textBreakStrategy="simple">+ Add New Item</Text>
                          </TouchableOpacity>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                  {lineItems.length > 1 && (
                    <TouchableOpacity onPress={() => removeItem(item.id)} style={{ marginLeft: 12, padding: 4 }}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 4, marginLeft: 2 }}>
                  Amount: ₹{(() => {
                    const base = (Number(item.rate) || 0) * (Number(item.qty) || 1);
                    const disc = showDiscount ? (Number(item.discount_percent) || 0) : 0;
                    return round2(base * (1 - disc / 100)).toLocaleString('en-IN');
                  })()}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <TextInput
                    key={`item_qty_${item.id}`}
                    blurOnSubmit={false}
                    style={styles.qtyInput}
                    value={String(item.qty)}
                    onChangeText={t => updateItem(item.id, 'qty', t)}
                    keyboardType="numeric"
                    placeholder="Qty"
                    placeholderTextColor="#94A3B8"
                  />
                  <Text style={{ color: '#94A3B8' }}>×</Text>
                  <TextInput
                    key={`item_rate_${item.id}`}
                    blurOnSubmit={false}
                    style={styles.rateInput}
                    value={String(item.rate)}
                    onChangeText={t => updateItem(item.id, 'rate', t)}
                    keyboardType="numeric"
                    placeholder="Rate (₹)"
                    placeholderTextColor="#94A3B8"
                  />
                  {showDiscount && (
                    <>
                      <Text style={{ color: '#94A3B8' }}>−</Text>
                      <TextInput
                        key={`item_disc_${item.id}`}
                        blurOnSubmit={false}
                        style={styles.qtyInput}
                        value={String(item.discount_percent)}
                        onChangeText={t => updateItem(item.id, 'discount_percent', t)}
                        keyboardType="numeric"
                        placeholder="Disc %"
                        placeholderTextColor="#94A3B8"
                      />
                    </>
                  )}
                </View>
                {(invoiceType !== 'NONGST' && !(invoiceType === 'SERVICE' && !isGstApplicable)) && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>GST Rate</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {GST_RATE_STRINGS.map(rate => (
                        <TouchableOpacity
                          key={rate}
                          onPress={() => updateItem(item.id, 'gst_rate', rate)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: String(item.gst_rate) === rate ? '#F97316' : '#FFF7ED',
                            borderWidth: 1,
                            borderColor: String(item.gst_rate) === rate ? '#F97316' : '#FED7AA',
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: String(item.gst_rate) === rate ? '#fff' : '#F97316' }}>
                            {rate}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ))}
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 }} onPress={addItem}>
              <Ionicons name="add" size={16} color="#F97316" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#F97316', flexShrink: 1 }} textBreakStrategy="simple">Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary card with orange tint */}
        <View style={[styles.card, { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#FFF7ED' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 13, color: '#92400E', flexShrink: 1 }} textBreakStrategy="simple">Subtotal (Taxable)</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400E', flexShrink: 1 }} textBreakStrategy="simple">₹{subtotal.toLocaleString('en-IN')}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: '#92400E' }}>GST</Text>
              <Text style={{ fontSize: 11, color: '#B45309' }}>{isInterState ? 'IGST' : 'CGST + SGST'}</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400E', alignSelf: 'flex-end', flexShrink: 1 }} textBreakStrategy="simple">₹{tax.toLocaleString('en-IN')}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: '#9ca3af' }}>Round Off</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#9ca3af' }}>₹{roundOff.toFixed(2)}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: '#FED7AA', marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>Total Amount</Text>
              <Text style={{ fontSize: 11, color: '#92400E' }}>Incl. all taxes</Text>
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#F97316', flexShrink: 1 }} textBreakStrategy="simple">₹{total.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Notes (optional) */}
        <View style={[styles.card, { marginHorizontal: 16, marginBottom: 16 }]}>
          <Text style={styles.cardLabel}>Notes (optional)</Text>
          <TextInput
            style={[styles.itemInput, { height: 60, textAlignVertical: 'top', minWidth: '100%', textAlign: 'left', paddingHorizontal: 10, paddingVertical: 6 }]}
            multiline
            placeholder="Add a note..."
            placeholderTextColor="#94A3B8"
            value={notes}
            onChangeText={setNotes}
            onFocus={() => {}}
          />
        </View>

        {/* Create Invoice button showing total */}
        <TouchableOpacity style={styles.createBtn} onPress={handleSubmit} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>
              {isEditMode ? `Save Changes · ₹${total.toLocaleString('en-IN')}` : `Create Invoice · ₹${total.toLocaleString('en-IN')}`}
            </Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* Customer Picker Modal */}
      <Modal
        visible={showCustomerPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setShowCustomerPicker(false); setPartySearch(''); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => { setShowCustomerPicker(false); setPartySearch(''); }}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search customers..."
                placeholderTextColor="#94A3B8"
                value={partySearch}
                onChangeText={setPartySearch}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
              onPress={() => { setShowCustomerPicker(false); router.push('/party/create'); }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person-add-outline" size={20} color="#F97316" />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#F97316' }}>Add New Customer</Text>
                <Text style={{ fontSize: 12, color: '#64748B' }}>Create a new party</Text>
              </View>
            </TouchableOpacity>
            <FlatList
              data={filteredParties}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedParty(item);
                    setConsignmentAddress(item.consignment_address || item.address || '');
                    const customerState = item.state || '';
                    const interState = businessState && customerState && businessState.toLowerCase().trim() !== customerState.toLowerCase().trim();
                    setIsInterState(!!interState);
                    setShowCustomerPicker(false);
                    setPartySearch('');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemName}>{item.name}</Text>
                    {item.gstin && <Text style={styles.modalItemSub}>GSTIN: {item.gstin}</Text>}
                  </View>
                  {item.phone && <Text style={styles.modalItemPhone}>{item.phone}</Text>}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No customers found</Text>
                </View>
              }
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>



      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Animated.View
                style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: '#16A34A',
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14,
                  transform: [{ scale: circleScale }],
                  shadowColor: '#16A34A', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
                }}
              >
                <Animated.View style={{ opacity: checkOpacity, transform: [{ scale: checkScale }] }}>
                  <Ionicons name="checkmark-sharp" size={36} color="#fff" />
                </Animated.View>
              </Animated.View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>Invoice Created!</Text>
              <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>{createdInvoice?.invoice_number}</Text>
            </View>

            {/* Share via WhatsApp */}
            <TouchableOpacity
              style={{ backgroundColor: '#25D366', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}
              onPress={() => shareInvoicePDF('whatsapp')}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', flexShrink: 1 }} textBreakStrategy="simple">Share on WhatsApp</Text>
            </TouchableOpacity>

            {/* View & Download */}
            <TouchableOpacity
              style={{ backgroundColor: '#F97316', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}
              onPress={() => shareInvoicePDF('download')}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', flexShrink: 1 }} textBreakStrategy="simple">Download PDF</Text>
            </TouchableOpacity>

            {/* View Invoice — opens PDF preview in-app */}
            <TouchableOpacity
              style={{ backgroundColor: '#F1F5F9', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}
              onPress={() => setShowPdfPreview(true)}
            >
              <Ionicons name="eye-outline" size={20} color="#374151" />
              <Text style={{ color: '#374151', fontSize: 14, fontWeight: '600', flexShrink: 1 }} textBreakStrategy="simple">View Invoice</Text>
            </TouchableOpacity>

            {/* Done — go to the created invoice detail */}
            <TouchableOpacity
              style={{ padding: 14, alignItems: 'center' }}
              onPress={() => {
                setShowSuccess(false);
                if (createdInvoice?.id) {
                  router.replace(`/invoice/${createdInvoice.id}`);
                } else {
                  router.replace('/(tabs)/bills');
                }
              }}
            >
              <Text style={{ color: '#64748B', fontSize: 14, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PDF Preview Modal */}
      <Modal visible={showPdfPreview} animationType="slide" onRequestClose={() => setShowPdfPreview(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={[styles.pdfHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setShowPdfPreview(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.pdfHeaderTitle} numberOfLines={1}>
              {createdInvoice?.invoice_number || 'Invoice'}
            </Text>
            <TouchableOpacity onPress={() => shareInvoicePDF('download')} style={{ padding: 6 }}>
              <Ionicons name="download-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, position: 'relative', backgroundColor: '#fff' }}>
            {!!createdInvoice?.share_token && !hasError && (
              <WebView
                source={{ html: pdfViewerHtml }}
                style={{ flex: 1, backgroundColor: '#F8FAFC' }}
                originWhitelist={['about:blank', 'https://*', 'http://*']}
                javaScriptEnabled={true}
                onLoadStart={() => setWebViewLoading(true)}
                onLoadEnd={() => setWebViewLoading(false)}
                onError={() => setHasError(true)}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'error') {
                      console.log('[PDF-VIEWER-ERROR [create]]', data.message);
                      setHasError(true);
                    }
                  } catch (err) {
                    console.log('[PDF-VIEWER-ERROR-PARSE [create]]', err);
                  }
                }}
              />
            )}
            {hasError && (
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                <Text style={{ fontSize: 14, color: '#64748B', marginTop: 10, textAlign: 'center' }}>
                  Could not load preview. Please try downloading or sharing the PDF instead.
                </Text>
              </View>
            )}
            {webViewLoading && !hasError && (
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.95)', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#F97316" />
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 10, fontWeight: '500' }}>Loading Preview...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: '#F97316',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F97316',
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    margin: 16,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: '#F97316',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  typeBtnTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  customerGstin: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemNamePlaceholder: {
    fontSize: 14,
    color: '#94A3B8',
  },
  itemNameInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    padding: 0,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 8,
  },
  itemInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0F172A',
    minWidth: 50,
    textAlign: 'center',
  },
  qtyInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0F172A',
    width: 80,
    textAlign: 'center',
  },
  rateInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0F172A',
    flex: 1,
    textAlign: 'center',
  },
  gstBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gstBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    padding: 0,
  },
  createBtn: {
    margin: 16,
    backgroundColor: '#F97316',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  modalItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
  },
  modalItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalItemPhone: {
    fontSize: 12,
    color: '#64748B',
    flexShrink: 1,
  },
  modalItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F97316',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  pdfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#0F172A',
  },
  pdfHeaderTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
});
