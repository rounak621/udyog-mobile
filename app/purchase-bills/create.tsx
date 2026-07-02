import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Modal, FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

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
      
      if (supRes.status === 'fulfilled') {
        setSuppliers(supRes.value.data || []);
      }
      if (itemRes.status === 'fulfilled') {
        const data = itemRes.value.data;
        setItems(Array.isArray(data) ? data : data.items || []);
      }
    } catch (err) {
      console.log('Load error in create purchase bill:', err);
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

  const total = subtotal + tax;

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
        total_amount: Number(total.toFixed(2)),
        line_items: lineItems.map(l => ({
          item_id: l.item_id || null,
          description: l.name,
          quantity: Number(l.qty),
          unit_price: Number(l.rate),
          discount_percent: Number(l.discount_percent) || 0,
          gst_percent: Number(l.gst_rate) || 0,
        })),
      };
      
      await api.post(`/purchase-bills/?business_id=${businessId}`, payload);
      Alert.alert('Success', 'Purchase bill recorded successfully');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create purchase bill');
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
          <Text style={styles.headerTitle}>New Purchase Bill</Text>
          <Text style={styles.headerSub}>Manual Entry</Text>
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
        {/* Invoice No + Date row */}
        <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 16, marginBottom: 16 }}>
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: '#92400E' }}>{isInterState ? 'IGST' : 'CGST + SGST'}</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400E' }}>₹{tax.toFixed(2)}</Text>
          </View>
          <View style={{ height: 0.5, backgroundColor: '#FED7AA', marginBottom: 10 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400E' }}>Total Amount</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.primary }}>₹{total.toFixed(2)}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 60, paddingHorizontal: 16, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
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
  emptyText: { color: Colors.textSecondary, fontSize: 14 }
});
