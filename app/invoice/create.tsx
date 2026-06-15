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
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: Math.random().toString(), item_id: null, name: '', qty: '1', rate: '', gst_rate: '18', unit: 'PCS' }
  ]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Invoice type state
  const [invoiceType, setInvoiceType] = useState<'INVOICE' | 'NONGST' | 'SERVICE'>('INVOICE');

  // Customer picker modal state
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // Item picker state
  const [showItemPicker, setShowItemPicker] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');

  // Success modal actions states
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);
  const [showSuccess, setShowSuccess] = useState(false);

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
        api.get(`/invoices/next-number?business_id=${bId}&invoice_type=${invoiceType}`),
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

  // Fetch next invoice number when invoiceType or businessId changes
  useEffect(() => {
    if (businessId) {
      api.get(`/invoices/next-number?business_id=${businessId}&invoice_type=${invoiceType}`)
        .then(res => setInvoiceNumber(res.data.invoice_number || res.data.next_number || ''))
        .catch(() => {});
    }
  }, [invoiceType, businessId]);

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
    const gstRateVal = invoiceType === 'NONGST' ? 0 : Number(l.gst_rate || 0);
    return sum + (amount * gstRateVal / 100);
  }, 0);
  const total = subtotal + tax;

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const shareInvoicePDF = async (mode: 'whatsapp' | 'download') => {
    if (!createdInvoice?.share_token) return;
    try {
      const pdfUrl = `https://api.udyogbook.in/api/v1/public/invoice/${createdInvoice.share_token}/pdf`;
      const fileUri = FileSystem.cacheDirectory + `invoice_${createdInvoice.invoice_number?.replace('/', '_')}.pdf`;
      const { uri } = await FileSystem.downloadAsync(pdfUrl, fileUri);
      if (mode === 'whatsapp') {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoice ${createdInvoice.invoice_number}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Download Invoice ${createdInvoice.invoice_number}`,
        });
      }
    } catch (err) {
      console.log('Share error:', err);
      Alert.alert('Error', 'Could not share PDF. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!selectedParty) { Alert.alert('Error', 'Please select a customer'); return; }
    if (lineItems.some(i => !i.name || !i.rate)) { Alert.alert('Error', 'Please fill all item details'); return; }
    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      
      const payload = {
        customer_id: selectedParty?.id || null,
        invoice_date: invoiceDate,
        invoice_type: invoiceType,
        status: 'ISSUED',
        notes: notes || undefined,
        line_items: lineItems.map(l => ({
          item_id: l.item_id || null,
          item_name: l.name,
          quantity: Number(l.qty) || 1,
          rate: Number(l.rate) || 0,
          gst_rate: invoiceType === 'NONGST' ? 0 : Number(l.gst_rate) || 0,
        })),
      };
      
      const res = await api.post(`/invoices/?business_id=${businessId}`, payload);
      const invoiceData = res.data?.invoice || res.data;
      const warnings = res.data?.warnings || [];
      if (warnings.length > 0) {
        Alert.alert('Stock Warning', warnings.join('\n'));
      }
      setCreatedInvoice(invoiceData);
      setShowSuccess(true);
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
        {/* Invoice Type Selector (Fix 1) */}
        <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 16 }}>
          {[
            { label: 'GST Invoice', value: 'INVOICE' },
            { label: 'Non-GST', value: 'NONGST' },
            { label: 'Service', value: 'SERVICE' },
          ].map(type => (
            <TouchableOpacity
              key={type.value}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: invoiceType === type.value ? '#F97316' : 'transparent' }}
              onPress={() => setInvoiceType(type.value as any)}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: invoiceType === type.value ? '#fff' : '#64748B' }}>{type.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
          <TouchableOpacity style={styles.partySelector} onPress={() => setShowCustomerPicker(true)}>
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
                {invoiceType === 'SERVICE' ? (
                  <TextInput
                    placeholder="Enter service name..."
                    value={item.name}
                    onChangeText={text => updateLineItem(item.id, 'name', text)}
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                  />
                ) : (
                  <TouchableOpacity
                    style={[styles.input, { flex: 1, marginRight: 8, justifyContent: 'center', minHeight: 40 }]}
                    onPress={() => setShowItemPicker(item.id)}
                  >
                    <Text style={{ color: item.name ? Colors.text : Colors.textMuted, fontSize: 13 }}>
                      {item.name || 'Select Item...'}
                    </Text>
                  </TouchableOpacity>
                )}
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
                {invoiceType !== 'NONGST' && (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>GST %</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={item.gst_rate} onChangeText={v => updateLineItem(item.id, 'gst_rate', v)} />
                  </View>
                )}
              </View>
              <Text style={styles.itemTotal}>
                Amount: {fmt((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0) * (1 + (invoiceType === 'NONGST' ? 0 : parseFloat(item.gst_rate) || 0) / 100))}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary (Fix 5) */}
        <View style={styles.card}>
          <View style={[styles.rowBetween, { marginBottom: 8 }]}>
            <Text style={{ fontSize: 13, color: Colors.textSecondary, flexShrink: 0 }}>Subtotal</Text>
            <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.text }}>{fmt(subtotal)}</Text>
          </View>
          {invoiceType !== 'NONGST' && (
            <View style={[styles.rowBetween, { marginBottom: 12 }]}>
              <Text style={{ fontSize: 13, color: Colors.textSecondary, flexShrink: 0 }}>GST Tax</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.text }}>{fmt(tax)}</Text>
            </View>
          )}
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

      {/* Customer Picker Modal (Fix 2) */}
      <Modal
        visible={showCustomerPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setShowCustomerPicker(false); setPartySearch(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => { setShowCustomerPicker(false); setPartySearch(''); }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={{ marginRight: 6 }} />
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
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedParty(item);
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
        </View>
      </Modal>

      {/* Item Picker Modal */}
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

      {/* Success Modal (Fix 4) */}
      <Modal visible={showSuccess} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="checkmark-circle" size={32} color="#16A34A" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>Invoice Created!</Text>
              <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>{createdInvoice?.invoice_number}</Text>
            </View>

            {/* Share via WhatsApp */}
            <TouchableOpacity
              style={{ backgroundColor: '#25D366', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}
              onPress={() => shareInvoicePDF('whatsapp')}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Share on WhatsApp</Text>
            </TouchableOpacity>

            {/* Download PDF */}
            <TouchableOpacity
              style={{ backgroundColor: '#F97316', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}
              onPress={() => shareInvoicePDF('download')}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Download PDF</Text>
            </TouchableOpacity>

            {/* View Invoice */}
            <TouchableOpacity
              style={{ backgroundColor: '#F1F5F9', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}
              onPress={() => { setShowSuccess(false); router.replace(`/invoice/${createdInvoice?.id}`); }}
            >
              <Ionicons name="eye-outline" size={20} color="#374151" />
              <Text style={{ color: '#374151', fontSize: 14, fontWeight: '600' }}>View Invoice</Text>
            </TouchableOpacity>

            {/* Done */}
            <TouchableOpacity
              style={{ padding: 14, alignItems: 'center' }}
              onPress={() => { setShowSuccess(false); router.replace('/(tabs)/bills'); }}
            >
              <Text style={{ color: '#64748B', fontSize: 14 }}>Done</Text>
            </TouchableOpacity>
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
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 14, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
  sectionLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, fontWeight: '700' },
  partySelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12 },
  selectedPartyName: { fontSize: 14, fontWeight: '500', color: Colors.text },
  selectedPartyGst: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  placeholder: { flex: 1, fontSize: 13, color: Colors.textMuted },
  input: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, fontSize: 13, color: Colors.text },
  inputLabel: { fontSize: 10, color: Colors.textSecondary, marginBottom: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addItemText: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
  lineItem: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginBottom: 8 },
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
  modalItemPhone: {
    fontSize: 12,
    color: Colors.textSecondary,
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
