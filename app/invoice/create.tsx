import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, Modal, FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

interface LineItem {
  id: string;
  item_id: any;
  name: string;
  qty: string;
  rate: string;
  gst_rate: string;
  unit: string;
}

export default function CreateInvoiceScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [partySearch, setPartySearch] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: Math.random().toString(), item_id: null, name: '', qty: '1', rate: '', gst_rate: '18', unit: 'PCS' }
  ]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Item picker state
  const [showItemPicker, setShowItemPicker] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');

  const loadData = async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      setBusinessId(bId);
      
      const [custRes, itemRes, numRes] = await Promise.allSettled([
        api.get(`/customers/?business_id=${bId}&limit=100`),
        api.get(`/items/?business_id=${bId}&limit=100`),
        api.get(`/invoices/next-number?business_id=${bId}&invoice_type=INVOICE`),
      ]);
      
      if (custRes.status === 'fulfilled') {
        const data = custRes.value.data;
        setParties(Array.isArray(data) ? data : data.customers || []);
      }
      if (itemRes.status === 'fulfilled') {
        const data = itemRes.value.data;
        setItems(Array.isArray(data) ? data : data.items || []);
      }
      if (numRes.status === 'fulfilled') {
        setInvoiceNumber(numRes.value.data.next_number || numRes.value.data.invoice_number || '');
      }
    } catch (err) {
      console.log('Load error:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredParties = parties.filter(p => p.name?.toLowerCase().includes(partySearch.toLowerCase()));

  const selectItem = (lineId: string, item: any) => {
    setLineItems(prev => prev.map(l => l.id === lineId ? {
      ...l,
      name: item.name,
      item_id: item.id,
      rate: String(item.rate || ''),
      gst_rate: String(item.gst_rate || '18'),
      unit: item.unit || 'PCS',
    } : l));
    setShowItemPicker(null);
  };

  const addLineItem = () => setLineItems(prev => [...prev, { id: Math.random().toString(), item_id: null, name: '', qty: '1', rate: '', gst_rate: '18', unit: 'PCS' }]);
  const removeLineItem = (id: string) => setLineItems(prev => prev.filter(l => l.id !== id));
  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  // Calculations
  const subtotal = lineItems.reduce((sum, l) => sum + (Number(l.rate) * Number(l.qty || 1)), 0);
  const tax = lineItems.reduce((sum, l) => {
    const amount = Number(l.rate) * Number(l.qty || 1);
    return sum + (amount * Number(l.gst_rate || 0) / 100);
  }, 0);
  const total = subtotal + tax;

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const handleSave = async () => {
    if (!selectedParty) { Alert.alert('Error', 'Please select a customer'); return; }
    if (lineItems.some(i => !i.name || !i.rate)) { Alert.alert('Error', 'Please fill all item details'); return; }
    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      
      const payload = {
        business_id: businessId,
        customer_id: selectedParty.id || null,
        invoice_date: invoiceDate,
        invoice_type: 'INVOICE',
        status: 'ISSUED',
        notes: notes || undefined,
        line_items: lineItems.map(l => ({
          item_id: l.item_id || null,
          item_name: l.name,
          quantity: Number(l.qty) || 1,
          rate: Number(l.rate) || 0,
          gst_rate: Number(l.gst_rate) || 0,
          unit: l.unit || 'PCS',
        })),
      };
      
      const res = await api.post(`/invoices/?business_id=${businessId}`, payload);
      Alert.alert('Success', 'Invoice created successfully', [
        { text: 'View Invoice', onPress: () => router.replace(`/invoice/${res.data.id}`) },
        { text: 'Create Another', onPress: () => router.replace('/invoice/create') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>New Invoice</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Invoice Number (Fix 4) */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Invoice Number</Text>
          <View style={[styles.input, { backgroundColor: '#F1F5F9', borderStyle: 'dashed', justifyContent: 'center', minHeight: 40 }]}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textSecondary }}>
              {invoiceNumber || 'Auto-generating...'}
            </Text>
          </View>
        </View>

        {/* Bill To */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Bill To</Text>
          <TouchableOpacity style={styles.partySelector} onPress={() => setShowPartyDropdown(true)}>
            {selectedParty ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedPartyName}>{selectedParty.name}</Text>
                {selectedParty.gstin && <Text style={styles.selectedPartyGst}>{selectedParty.gstin}</Text>}
              </View>
            ) : (
              <Text style={styles.placeholder}>Select customer...</Text>
            )}
            <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          {showPartyDropdown && (
            <View style={styles.dropdown}>
              <View style={styles.dropdownSearch}>
                <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
                <TextInput style={styles.dropdownInput} placeholder="Search..." placeholderTextColor={Colors.textMuted} value={partySearch} onChangeText={setPartySearch} autoFocus />
              </View>
              <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
                {filteredParties.slice(0, 20).map(p => (
                  <TouchableOpacity key={p.id} style={styles.dropdownItem} onPress={() => { setSelectedParty(p); setShowPartyDropdown(false); setPartySearch(''); }}>
                    <Text style={styles.dropdownItemText}>{p.name}</Text>
                    {p.gstin && <Text style={styles.dropdownItemSub}>{p.gstin}</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Invoice Date</Text>
          <TextInput style={styles.input} value={invoiceDate} onChangeText={setInvoiceDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
        </View>

        {/* Items */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>Items</Text>
            <TouchableOpacity style={styles.addItemBtn} onPress={addLineItem}>
              <Ionicons name="add" size={14} color={Colors.primary} />
              <Text style={styles.addItemText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {lineItems.map((item, i) => (
            <View key={item.id} style={styles.lineItem}>
              <View style={styles.rowBetween}>
                {/* Touchable Item Selector (Fix 2) */}
                <TouchableOpacity
                  style={[styles.input, { flex: 1, marginRight: 8, justifyContent: 'center', minHeight: 40 }]}
                  onPress={() => setShowItemPicker(item.id)}
                >
                  <Text style={{ color: item.name ? Colors.text : Colors.textMuted, fontSize: 13 }}>
                    {item.name || 'Select Item...'}
                  </Text>
                </TouchableOpacity>
                {lineItems.length > 1 && (
                  <TouchableOpacity onPress={() => removeLineItem(item.id)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Qty</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={item.qty} onChangeText={v => updateLineItem(item.id, 'qty', v)} />
                </View>
                <View style={{ flex: 1.5, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Rate (₹)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={item.rate} onChangeText={v => updateLineItem(item.id, 'rate', v)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>GST %</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={item.gst_rate} onChangeText={v => updateLineItem(item.id, 'gst_rate', v)} />
                </View>
              </View>
              <Text style={styles.itemTotal}>
                Amount: {fmt((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0) * (1 + (parseFloat(item.gst_rate) || 0) / 100))}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary (Fix 5) */}
        <View style={styles.card}>
          <View style={[styles.rowBetween, { marginBottom: 8 }]}>
            <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Subtotal</Text>
            <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.text }}>{fmt(subtotal)}</Text>
          </View>
          <View style={[styles.rowBetween, { marginBottom: 12 }]}>
            <Text style={{ fontSize: 13, color: Colors.textSecondary }}>GST Tax</Text>
            <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.text }}>{fmt(tax)}</Text>
          </View>
          <View style={[styles.totalRow, { borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 10 }]}>
            <Text style={styles.totalFinalLabel}>Total Amount</Text>
            <Text style={styles.totalFinalValue}>{fmt(total)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Notes (optional)</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline placeholder="Add a note..." placeholderTextColor={Colors.textMuted} value={notes} onChangeText={setNotes} />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Invoice</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Item Picker Modal (Fix 2) */}
      <Modal
        visible={showItemPicker !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setShowItemPicker(null); setItemSearch(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Item</Text>
              <TouchableOpacity onPress={() => { setShowItemPicker(null); setItemSearch(''); }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search items..."
                placeholderTextColor={Colors.textMuted}
                value={itemSearch}
                onChangeText={setItemSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={items.filter(item => item.name?.toLowerCase().includes(itemSearch.toLowerCase()))}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    if (showItemPicker) {
                      selectItem(showItemPicker, item);
                      setItemSearch('');
                    }
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemName}>{item.name}</Text>
                    <Text style={styles.modalItemSub}>{item.unit || 'PCS'} · GST: {item.gst_rate || 0}%</Text>
                  </View>
                  <Text style={styles.modalItemPrice}>₹{item.rate || 0}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No items found</Text>
                </View>
              }
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { padding: 4, marginRight: 8 },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  content: { padding: 12, gap: 10, paddingBottom: 40 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: Colors.border },
  sectionLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  partySelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 12 },
  selectedPartyName: { fontSize: 14, fontWeight: '500', color: Colors.text },
  selectedPartyGst: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  placeholder: { flex: 1, fontSize: 13, color: Colors.textMuted },
  dropdown: { marginTop: 8, backgroundColor: Colors.card, borderRadius: Radius.sm, borderWidth: 0.5, borderColor: Colors.border, overflow: 'hidden' },
  dropdownSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  dropdownInput: { flex: 1, fontSize: 13, color: Colors.text },
  dropdownItem: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  dropdownItemText: { fontSize: 13, fontWeight: '500', color: Colors.text },
  dropdownItemSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 10, fontSize: 13, color: Colors.text },
  inputLabel: { fontSize: 10, color: Colors.textSecondary, marginBottom: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addItemText: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
  lineItem: { backgroundColor: '#F8FAFC', borderRadius: Radius.sm, padding: 10, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border },
  itemTotal: { fontSize: 12, color: Colors.primary, fontWeight: '500', textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalFinalLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  totalFinalValue: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, padding: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
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
    color: Colors.text,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    padding: 0,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  modalItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
  },
  modalItemSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
