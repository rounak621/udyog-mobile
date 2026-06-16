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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
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

  // Helper aliases to match mockup JSX names perfectly (moved below definitions)

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

  const shareInvoicePDF = async (mode: 'whatsapp' | 'download') => {
    if (!createdInvoice?.share_token) return;
    try {
      const pdfUrl = `https://api.udyogbook.in/api/v1/public/invoice/${createdInvoice.share_token}/pdf`;
      const fileUri = (FileSystem as any).cacheDirectory + `invoice_${createdInvoice.invoice_number?.replace('/', '_')}.pdf`;
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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F8FAFC' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>New Invoice</Text>
          <Text style={styles.headerSub}>Draft · auto-saved</Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#F97316" size="small" />
          ) : (
            <>
              <Ionicons name="save-outline" size={16} color="#F97316" />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Invoice type toggle */}
        <View style={styles.typeToggle}>
          {[
            { label: 'GST Invoice', value: 'INVOICE' },
            { label: 'Non-GST', value: 'NONGST' },
            { label: 'Service', value: 'SERVICE' }
          ].map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.typeBtn, invoiceType === t.value && styles.typeBtnActive]}
              onPress={() => setInvoiceType(t.value as any)}
            >
              <Text style={[styles.typeBtnText, invoiceType === t.value && styles.typeBtnTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Invoice No + Date row (side by side) */}
        <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 }}>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.cardLabel}>INVOICE NO.</Text>
            <Text style={styles.cardValue}>{invoiceNumber || 'Auto-generating...'}</Text>
          </View>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.cardLabel}>DATE (YYYY-MM-DD)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TextInput
                style={[styles.cardValue, { padding: 0, flex: 1 }]}
                value={invoiceDate}
                onChangeText={setInvoiceDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
              />
              <Ionicons name="calendar-outline" size={14} color="#94A3B8" />
            </View>
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

        {/* Items Section */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.sectionLabel}>ITEMS · {lineItems.length}</Text>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={addItem}>
              <Ionicons name="add" size={16} color="#F97316" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#F97316' }}>Add Item</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            {lineItems.map((item, index) => (
              <View key={item.id}>
                {index > 0 && <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 }} />}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* Item name */}
                  {invoiceType === 'SERVICE' ? (
                    <TextInput
                      style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, minHeight: 44, fontSize: 14, fontWeight: '600', color: '#0F172A' }}
                      placeholder="Enter service name..."
                      placeholderTextColor="#94A3B8"
                      value={item.name}
                      onChangeText={t => updateItem(item.id, 'name', t)}
                    />
                  ) : (
                    <TouchableOpacity 
                      style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, minHeight: 44, justifyContent: 'center' }} 
                      onPress={() => setShowItemPicker(item.id)}
                    >
                      <Text style={item.name ? { fontSize: 14, fontWeight: '600', color: '#0F172A' } : { fontSize: 14, color: '#94A3B8' }}>
                        {item.name || '+ Select item...'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {lineItems.length > 1 && (
                    <TouchableOpacity onPress={() => removeItem(item.id)} style={{ marginLeft: 12, padding: 4 }}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 4, marginLeft: 2 }}>
                  Amount: ₹{((Number(item.rate) || 0) * (Number(item.qty) || 1)).toLocaleString('en-IN')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <TextInput
                    style={styles.itemInput}
                    value={String(item.qty)}
                    onChangeText={t => updateItem(item.id, 'qty', t)}
                    keyboardType="numeric"
                    placeholder="Qty"
                  />
                  <Text style={{ color: '#94A3B8' }}>×</Text>
                  <TextInput
                    style={[styles.itemInput, { flex: 1 }]}
                    value={String(item.rate)}
                    onChangeText={t => updateItem(item.id, 'rate', t)}
                    keyboardType="numeric"
                    placeholder="Rate (₹)"
                  />
                  {invoiceType !== 'NONGST' && (
                    <View style={styles.gstBadge}>
                      <TextInput
                        style={styles.gstBadgeText}
                        value={String(item.gst_rate)}
                        onChangeText={t => updateItem(item.id, 'gst_rate', t)}
                        keyboardType="numeric"
                      />
                      <Text style={styles.gstBadgeText}>% GST</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Summary card with orange tint */}
        <View style={[styles.card, { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#FFF7ED' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 13, color: '#92400E' }}>Subtotal (Taxable)</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400E' }}>₹{subtotal.toLocaleString('en-IN')}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: '#92400E' }}>GST · CGST + SGST</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400E' }}>₹{tax.toLocaleString('en-IN')}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: '#FED7AA', marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>Total Amount</Text>
              <Text style={{ fontSize: 11, color: '#92400E' }}>Incl. all taxes</Text>
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#F97316' }}>₹{total.toLocaleString('en-IN')}</Text>
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
          />
        </View>

        {/* Create Invoice button showing total */}
        <TouchableOpacity style={styles.createBtn} onPress={handleSubmit} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Create Invoice · ₹{total.toLocaleString('en-IN')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Customer Picker Modal */}
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
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search items..."
                placeholderTextColor="#94A3B8"
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

      {/* Success Modal */}
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
});
