import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Modal, FlatList
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as ImagePicker from 'expo-image-picker';

interface LineItem {
  id: string;
  item_id: number | null;
  name: string;
  qty: string;
  rate: string;
  gst_rate: string;
  discount_percent: string;
  unit: string;
  isCustom?: boolean;
}

export default function CreatePurchaseBillScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessState, setBusinessState] = useState('');
  const [isInterState, setIsInterState] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: Math.random().toString(), item_id: null, name: '', qty: '1', rate: '', gst_rate: '18', discount_percent: '0', unit: 'PCS', isCustom: false }
  ]);
  const [saving, setSaving] = useState(false);

  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [itemSearch, setItemSearch] = useState<Record<string, string>>({});
  const [showItemDropdown, setShowItemDropdown] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [customRoundOff, setCustomRoundOff] = useState<string | null>(null);

  const uploadAndScanImage = async (uri: string) => {
    setScanning(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const formData = new FormData();
      const filename = uri.split('/').pop() || 'bill.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      // React Native FormData expects an object with uri, name, type
      formData.append('file', {
        uri,
        name: filename,
        type,
      } as any);

      if (businessId) {
        formData.append('business_id', businessId);
      }

      const res = await api.post('/ai/scan-purchase-bill', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 seconds timeout as requested
      });

      const data = res.data;
      if (!data) throw new Error('No data returned');

      if (data.invoice_number) setInvoiceNumber(data.invoice_number);
      if (data.bill_date) setBillDate(data.bill_date);

      // Resolve supplier
      let matchedSupplier = null;
      if (data.supplier_id) {
        matchedSupplier = suppliers.find(s => String(s.id) === String(data.supplier_id));
      }
      
      if (!matchedSupplier && data.supplier_name) {
        const nameKey = data.supplier_name.toLowerCase().trim();
        matchedSupplier = suppliers.find(s => s.name?.toLowerCase().trim() === nameKey);
      }

      if (!matchedSupplier && data.supplier_id) {
        // Supplier might have been auto-created but not fetched yet in our local state. Reload.
        try {
          const bizRes = await api.get('/businesses/me');
          const bId = bizRes.data.id;
          const supRes = await api.get(`/suppliers/?business_id=${bId}`);
          const newSuppliers = supRes.data || [];
          setSuppliers(newSuppliers);
          matchedSupplier = newSuppliers.find((s: any) => String(s.id) === String(data.supplier_id) || s.name?.toLowerCase().trim() === data.supplier_name?.toLowerCase().trim());
        } catch {}
      }

      if (matchedSupplier) {
        setSelectedSupplier(matchedSupplier);
        const customerState = matchedSupplier.state || '';
        const interState = businessState && customerState && businessState.toLowerCase().trim() !== customerState.toLowerCase().trim();
        setIsInterState(!!interState);
      }

      // Line items mapping
      let calculatedGstPercent = '18';
      if (data.taxable_value && data.taxable_value > 0) {
        const totalTax = (data.cgst_amount || 0) + (data.sgst_amount || 0) + (data.igst_amount || 0);
        if (totalTax > 0) {
          const gstRate = Math.round((totalTax / data.taxable_value) * 100);
          const standardRates = [0, 5, 12, 18, 28];
          const nearest = standardRates.reduce((prev, curr) => 
            Math.abs(curr - gstRate) < Math.abs(prev - gstRate) ? curr : prev
          );
          calculatedGstPercent = String(nearest);
        }
      }

      if (data.line_items && data.line_items.length > 0) {
        const mapped = data.line_items.map((item: any) => {
          const catalogMatch = items.find(
            (i: any) => i.id === item.item_id || i.name?.toLowerCase().trim() === item.description?.toLowerCase().trim()
          );

          return {
            id: Math.random().toString(),
            item_id: catalogMatch?.id || item.item_id || null,
            name: item.description || catalogMatch?.name || 'Scanned Item',
            qty: String(item.quantity || 1),
            rate: String(item.unit_price || catalogMatch?.price || 0),
            gst_rate: String(Math.round(Number(item.gst_percent || catalogMatch?.gst_rate || calculatedGstPercent || 0))),
            discount_percent: String(item.discount_percent || 0),
            unit: (item.unit || catalogMatch?.unit || 'PCS').toUpperCase(),
            isCustom: !catalogMatch,
          };
        });
        setLineItems(mapped);
      } else if (data.taxable_value && data.taxable_value > 0) {
        // Fallback: single line item with aggregate total
        setLineItems([{
          id: Math.random().toString(),
          item_id: null,
          name: 'Goods / Services (from bill)',
          qty: '1',
          rate: String(data.taxable_value),
          gst_rate: calculatedGstPercent,
          discount_percent: '0',
          unit: 'PCS',
          isCustom: true
        }]);
      }

      Alert.alert('Scan Success', 'Bill scanned and fields pre-filled!');
    } catch (err: any) {
      console.log('AI scan error:', err);
      Alert.alert(
        'Scan Failed',
        err.response?.data?.detail || 'AI extraction failed. Please try again or fill in manually.'
      );
    } finally {
      setScanning(false);
    }
  };

  const handleScan = async (useCamera: boolean) => {
    try {
      const permissionResult = useCamera 
        ? await ImagePicker.requestCameraPermissionsAsync() 
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', `Permission to access ${useCamera ? 'camera' : 'photos'} is required.`);
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const selectedAsset = result.assets[0];
      await uploadAndScanImage(selectedAsset.uri);
    } catch (err) {
      console.log('Scan launch error:', err);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const loadData = async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      setBusinessId(bId);
      setBusinessState(bizRes.data.state || '');
      
      const [supRes, itemRes] = await Promise.allSettled([
        api.get(`/suppliers/?business_id=${bId}`),
        api.get(`/items/?business_id=${bId}&limit=100`),
      ]);
      
      let fetchedSuppliers: any[] = [];
      if (supRes.status === 'fulfilled') {
        fetchedSuppliers = supRes.value.data || [];
        setSuppliers(fetchedSuppliers);
      }
      
      let fetchedItems: any[] = [];
      if (itemRes.status === 'fulfilled') {
        const data = itemRes.value.data;
        fetchedItems = Array.isArray(data) ? data : data.items || [];
        setItems(fetchedItems);
      }

      if (editId) {
        const billRes = await api.get(`/purchase-bills/${editId}?business_id=${bId}`);
        const billData = billRes.data;
        if (billData) {
          if (billData.payment_status !== 'UNPAID') {
            Alert.alert(
              'Cannot Edit',
              'This purchase bill is already paid or partially paid and cannot be edited.',
              [{ text: 'OK', onPress: () => router.back() }]
            );
            return;
          }
          
          setInvoiceNumber(billData.supplier_invoice_number || '');
          setBillDate(billData.bill_date);
          setCustomRoundOff(billData.round_off !== 0 ? String(billData.round_off) : null);
          
          if (billData.supplier) {
            setSelectedSupplier(billData.supplier);
            const customerState = billData.supplier.state || '';
            const interState = bizRes.data.state && customerState && bizRes.data.state.toLowerCase().trim() !== customerState.toLowerCase().trim();
            setIsInterState(!!interState);
          }
          
          if (billData.items && billData.items.length > 0) {
            const mapped = billData.items.map((item: any) => {
              const catalogMatch = fetchedItems.find(
                (i: any) => i.id === item.item_id || i.name?.toLowerCase().trim() === item.description?.toLowerCase().trim()
              );
              return {
                id: Math.random().toString(),
                item_id: item.item_id || null,
                name: item.description,
                qty: String(item.quantity),
                rate: String(item.unit_price),
                gst_rate: String(Math.round(Number(item.gst_percent || 0))),
                discount_percent: String(item.discount_percent),
                unit: (catalogMatch?.unit || 'PCS').toUpperCase(),
                isCustom: !catalogMatch,
              };
            });
            setLineItems(mapped);
          }
        }
      }
    } catch (err: any) {
      console.log('Load error in create purchase bill:', err);
      if (editId) {
        Alert.alert('Error', 'Failed to load purchase bill details');
        router.back();
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSuppliers = suppliers.filter(s => s.name?.toLowerCase().includes(supplierSearch.toLowerCase()));

  const addLineItem = () => setLineItems(prev => [
    ...prev,
    { id: Math.random().toString(), item_id: null, name: '', qty: '1', rate: '', gst_rate: '18', discount_percent: '0', unit: 'PCS', isCustom: false }
  ]);

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter(l => l.id !== id));
  };

  const updateLineItem = useCallback((id: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }, []);

  // Calculations
  const subtotal = lineItems.reduce((sum, l) => {
    const qty = Number(l.qty) || 0;
    const rate = Number(l.rate) || 0;
    const discount = Number(l.discount_percent || 0);
    return sum + (qty * rate * (1 - discount / 100));
  }, 0);

  const tax = lineItems.reduce((sum, l) => {
    const qty = Number(l.qty) || 0;
    const rate = Number(l.rate) || 0;
    const discount = Number(l.discount_percent || 0);
    const amount = qty * rate * (1 - discount / 100);
    const gstRateVal = Number(l.gst_rate || 0);
    return sum + (amount * gstRateVal / 100);
  }, 0);

  const exactTotal = subtotal + tax;
  const roundedTotal = Math.round(exactTotal);
  const autoRoundOff = roundedTotal - exactTotal;
  const roundOff = customRoundOff !== null ? (Number(customRoundOff) || 0) : autoRoundOff;
  const finalTotal = exactTotal + roundOff;

  const handleSave = async () => {
    if (!selectedSupplier) { Alert.alert('Error', 'Please select a supplier'); return; }
    if (!invoiceNumber.trim()) { Alert.alert('Error', 'Supplier invoice number is required'); return; }
    if (lineItems.some(i => !i.name && !i.item_id)) { Alert.alert('Error', 'Please select or fill all item descriptions'); return; }
    if (lineItems.some(i => (Number(i.qty) || 0) <= 0 || (Number(i.rate) || 0) <= 0)) { Alert.alert('Error', 'Quantity and rate must be greater than zero'); return; }

    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      
      const payload = {
        supplier_id: selectedSupplier.id,
        bill_date: billDate,
        supplier_invoice_number: invoiceNumber.trim(),
        subtotal: Number(subtotal.toFixed(2)),
        tax_amount: Number(tax.toFixed(2)),
        total_amount: Number(finalTotal.toFixed(2)),
        line_items: lineItems.map(l => ({
          item_id: l.item_id || null,
          description: l.name,
          quantity: Number(l.qty),
          unit_price: Number(l.rate),
          discount_percent: Number(l.discount_percent) || 0,
          gst_percent: Number(l.gst_rate) || 0,
        })),
      };
      
      if (editId) {
        await api.put(`/purchase-bills/${editId}?business_id=${businessId}`, payload);
        Alert.alert('Success', 'Purchase bill updated successfully');
      } else {
        await api.post(`/purchase-bills/?business_id=${businessId}`, payload);
        Alert.alert('Success', 'Purchase bill recorded successfully');
      }
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save purchase bill');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'SP';
    return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{editId ? 'Edit Purchase Bill' : 'New Purchase Bill'}</Text>
          <Text style={styles.headerSub}>{editId ? 'Update Bill Details' : 'Manual Entry'}</Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#F97316" size="small" />
          ) : (
            <>
              <Ionicons name="save-outline" size={16} color="#F97316" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{ paddingBottom: 40 }}
        enableOnAndroid={true}
        extraScrollHeight={150}
        keyboardShouldPersistTaps="handled"
      >
        {/* AI Scan Container */}
        <View style={styles.scanContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Ionicons name="sparkles" size={16} color={Colors.primary} />
            <Text style={styles.scanTitle}>Scan Bill with Maya AI</Text>
          </View>
          <Text style={styles.scanSubtitle}>
            Upload or take a photo of your purchase bill. Maya will read and pre-fill the fields.
          </Text>
          <View style={styles.scanButtons}>
            <TouchableOpacity style={styles.scanBtnAction} onPress={() => handleScan(true)}>
              <Ionicons name="camera-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.scanBtnTextAction}>Use Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.scanBtnAction, styles.scanBtnGallery]} onPress={() => handleScan(false)}>
              <Ionicons name="images-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.scanBtnTextAction, { color: Colors.primary }]}>Choose Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Invoice No + Date row */}
        <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 4, marginBottom: 16 }}>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.cardLabel}>BILL / INVOICE NO.</Text>
            <TextInput
              style={{ fontSize: 15, fontWeight: '700', color: Colors.text, padding: 0 }}
              placeholder="Enter number..."
              placeholderTextColor={Colors.textMuted}
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
            />
          </View>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.cardLabel}>DATE</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}>
                {billDate ? new Date(billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select date'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={billDate ? new Date(billDate) : new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setBillDate(selectedDate.toISOString().split('T')[0]);
                  }
                }}
              />
            )}
          </View>
        </View>

        {/* Supplier Selector */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={styles.sectionLabel}>Supplier</Text>
          <TouchableOpacity style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]} onPress={() => setShowSupplierPicker(true)}>
            {selectedSupplier ? (
              <>
                <View style={styles.customerAvatar}>
                  <Text style={styles.customerAvatarText}>{getInitials(selectedSupplier.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardValue}>{selectedSupplier.name}</Text>
                  {selectedSupplier.gstin && <Text style={styles.customerGstin}>GSTIN {selectedSupplier.gstin}</Text>}
                </View>
              </>
            ) : (
              <Text style={{ color: Colors.textMuted, fontSize: 14, flex: 1 }}>Select supplier...</Text>
            )}
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Items Section */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.sectionLabel}>ITEMS · {lineItems.length}</Text>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={addLineItem}>
              <Ionicons name="add" size={16} color={Colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.primary }}>Add Item</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            {lineItems.map((item, index) => (
              <View key={item.id}>
                {index > 0 && <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 12 }} />}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    {item.isCustom ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 8, paddingRight: 12 }}>
                        <TextInput
                          blurOnSubmit={false}
                          style={{ flex: 1, padding: 12, minHeight: 44, fontSize: 14, fontWeight: '600', color: Colors.text }}
                          placeholder="Type item name..."
                          placeholderTextColor={Colors.textMuted}
                          value={item.name}
                          onChangeText={t => updateLineItem(item.id, 'name', t)}
                          autoFocus
                        />
                        <TouchableOpacity onPress={() => {
                          updateLineItem(item.id, 'isCustom', false);
                          updateLineItem(item.id, 'name', '');
                          updateLineItem(item.id, 'item_id', null);
                        }}>
                          <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
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
                          <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.text }} numberOfLines={1}>{item.name}</Text>
                          <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                            ₹{item.rate} · {item.gst_rate}% GST
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
                          <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '600' }}>Change</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, minHeight: 44, justifyContent: 'center' }}
                        onPress={() => setShowItemDropdown(item.id)}
                      >
                        <Text style={{ fontSize: 14, color: Colors.textMuted, fontWeight: '400' }}>
                          Select item...
                        </Text>
                      </TouchableOpacity>
                    )}

                    {showItemDropdown === item.id && (
                      <View style={{ backgroundColor: '#fff', borderRadius: 8, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, marginTop: 8 }}>
                        <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                          <TouchableOpacity
                            style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: '#FFF7ED' }}
                            onPress={() => {
                              updateLineItem(item.id, 'isCustom', true);
                              updateLineItem(item.id, 'name', '');
                              updateLineItem(item.id, 'item_id', null);
                              setShowItemDropdown(null);
                            }}
                          >
                            <Ionicons name="create-outline" size={18} color={Colors.primary} />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.primary }}>Custom Item</Text>
                          </TouchableOpacity>
                          {items.filter(i => i.name?.toLowerCase().includes((itemSearch[item.id] || '').toLowerCase())).map(prod => (
                            <TouchableOpacity
                              key={String(prod.id)}
                              style={{ padding: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border }}
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
                              <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text }}>{prod.name}</Text>
                              <Text style={{ fontSize: 11, color: Colors.textSecondary }}>₹{prod.rate || prod.price} · {prod.gst_rate}% GST</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                  {lineItems.length > 1 && (
                    <TouchableOpacity onPress={() => removeLineItem(item.id)} style={{ marginLeft: 12, padding: 4 }}>
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* Inputs for qty, rate, discount */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <TextInput
                    style={styles.qtyInput}
                    value={String(item.qty)}
                    onChangeText={t => updateLineItem(item.id, 'qty', t)}
                    keyboardType="numeric"
                    placeholder="Qty"
                  />
                  <Text style={{ color: Colors.textMuted }}>×</Text>
                  <TextInput
                    style={styles.rateInput}
                    value={String(item.rate)}
                    onChangeText={t => updateLineItem(item.id, 'rate', t)}
                    keyboardType="numeric"
                    placeholder="Rate (₹)"
                  />
                  <TextInput
                    style={[styles.qtyInput, { flex: 1.2 }]}
                    value={String(item.discount_percent)}
                    onChangeText={t => updateLineItem(item.id, 'discount_percent', t)}
                    keyboardType="numeric"
                    placeholder="Disc %"
                  />
                </View>
                
                {/* GST chips */}
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 11, color: Colors.textSecondary, marginBottom: 6 }}>GST Rate</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {['0', '5', '12', '18', '28'].map(rate => (
                      <TouchableOpacity
                        key={rate}
                        onPress={() => updateLineItem(item.id, 'gst_rate', rate)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 6,
                          borderRadius: 20,
                          backgroundColor: String(item.gst_rate) === rate ? Colors.primary : '#FFF7ED',
                          borderWidth: 1,
                          borderColor: String(item.gst_rate) === rate ? Colors.primary : '#FED7AA',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: String(item.gst_rate) === rate ? '#fff' : Colors.primary }}>
                          {rate}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Summary Details */}
        <View style={[styles.card, { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#FFF7ED' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 13, color: '#92400E' }}>Subtotal (Taxable)</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400E' }}>₹{subtotal.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 13, color: '#92400E' }}>{isInterState ? 'IGST' : 'CGST + SGST'}</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400E' }}>₹{tax.toFixed(2)}</Text>
          </View>

          <View style={{ height: 0.5, backgroundColor: '#FED7AA', marginVertical: 8 }} />
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400E' }}>Total Amount</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.primary }}>₹{finalTotal.toFixed(2)}</Text>
          </View>

          <View style={{ height: 0.5, backgroundColor: '#FED7AA', marginBottom: 12 }} />

          {/* Round Off Line with manual input override */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#92400E' }}>Round Off</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TextInput
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#92400E',
                  backgroundColor: '#FED7AA',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 4,
                  minWidth: 60,
                  textAlign: 'right',
                }}
                keyboardType="numeric"
                value={customRoundOff !== null ? customRoundOff : roundOff.toFixed(2)}
                placeholder="0.00"
                onChangeText={(text) => {
                  setCustomRoundOff(text);
                }}
                onBlur={() => {
                  if (customRoundOff === '') {
                    setCustomRoundOff(null);
                  }
                }}
              />
              {customRoundOff !== null && (
                <TouchableOpacity onPress={() => setCustomRoundOff(null)}>
                  <Ionicons name="refresh-circle" size={16} color="#92400E" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>

      {/* Supplier Picker Modal */}
      <Modal
        visible={showSupplierPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setShowSupplierPicker(false); setSupplierSearch(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Supplier</Text>
              <TouchableOpacity onPress={() => { setShowSupplierPicker(false); setSupplierSearch(''); }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search suppliers..."
                placeholderTextColor={Colors.textMuted}
                value={supplierSearch}
                onChangeText={setSupplierSearch}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }}
              onPress={() => { setShowSupplierPicker(false); router.push('/party/create'); }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.primary }}>Add New Supplier</Text>
                <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Create a new party</Text>
              </View>
            </TouchableOpacity>
            <FlatList
              data={filteredSuppliers}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedSupplier(item);
                    const customerState = item.state || '';
                    const interState = businessState && customerState && businessState.toLowerCase().trim() !== customerState.toLowerCase().trim();
                    setIsInterState(!!interState);
                    setShowSupplierPicker(false);
                    setSupplierSearch('');
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
                  <Text style={styles.emptyText}>No suppliers found</Text>
                </View>
              }
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>

      {/* AI Scanning Modal */}
      <Modal visible={scanning} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingTitle}>Reading Bill with Maya AI...</Text>
            <Text style={styles.loadingSubtitle}>Extracting items, tax rates, dates, invoice numbers and supplier details.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 60, paddingHorizontal: 16, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', flexDirection: 'row', alignItems: 'center' },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  card: { backgroundColor: '#fff', borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border, elevation: 1, shadowColor: '#94A3B8', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  cardLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 6 },
  cardValue: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  customerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  customerAvatarText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  customerGstin: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  qtyInput: { flex: 1, height: 40, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 13, color: Colors.text, backgroundColor: '#F8FAFC' },
  rateInput: { flex: 2, height: 40, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 13, color: Colors.text, backgroundColor: '#F8FAFC' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%', paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.border, margin: 12, borderRadius: 8, paddingHorizontal: 12, height: 40 },
  modalSearchInput: { flex: 1, fontSize: 14, color: Colors.text, paddingVertical: 8 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  modalItemName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  modalItemSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  modalItemPhone: { fontSize: 13, color: Colors.textSecondary },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontSize: 14 },
  scanContainer: { backgroundColor: '#F8FAFC', borderRadius: Radius.md, padding: 16, marginHorizontal: 16, marginTop: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  scanTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  scanSubtitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  scanButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  scanBtnAction: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  scanBtnGallery: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  scanBtnTextAction: { color: '#fff', fontSize: 12, fontWeight: '700' },
  loadingOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center' },
  loadingContent: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 24, width: '80%', alignItems: 'center', gap: 12 },
  loadingTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  loadingSubtitle: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
});
