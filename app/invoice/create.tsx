import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

interface Item {
  item_name: string;
  quantity: string;
  rate: string;
  gst_rate: string;
  unit: string;
}

export default function CreateInvoiceScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [partySearch, setPartySearch] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState<Item[]>([{ item_name: '', quantity: '1', rate: '', gst_rate: '18', unit: 'PCS' }]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const [partiesRes, itemsRes] = await Promise.allSettled([
          api.get('/customers?limit=100'),
          api.get('/items?limit=100'),
        ]);
        if (partiesRes.status === 'fulfilled') setParties(partiesRes.value.data.customers || partiesRes.value.data || []);
        if (itemsRes.status === 'fulfilled') setItems(itemsRes.value.data.items || itemsRes.value.data || []);
      } catch {}
    };
    load();
  }, []);

  const filteredParties = parties.filter(p => p.name?.toLowerCase().includes(partySearch.toLowerCase()));

  const addLineItem = () => setLineItems(prev => [...prev, { item_name: '', quantity: '1', rate: '', gst_rate: '18', unit: 'PCS' }]);
  const removeLineItem = (i: number) => setLineItems(prev => prev.filter((_, idx) => idx !== i));
  const updateLineItem = (i: number, field: keyof Item, value: string) => {
    setLineItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const calcTotal = () => {
    return lineItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      const gst = parseFloat(item.gst_rate) || 0;
      const base = qty * rate;
      return sum + base + (base * gst / 100);
    }, 0);
  };

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const handleSave = async () => {
    if (!selectedParty) { Alert.alert('Error', 'Please select a customer'); return; }
    if (lineItems.some(i => !i.item_name || !i.rate)) { Alert.alert('Error', 'Please fill all item details'); return; }
    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      const payload = {
        customer_id: selectedParty.id,
        invoice_date: invoiceDate,
        notes,
        items: lineItems.map(i => ({
          item_name: i.item_name,
          quantity: parseFloat(i.quantity) || 1,
          rate: parseFloat(i.rate) || 0,
          gst_rate: parseFloat(i.gst_rate) || 0,
          unit: i.unit,
        })),
      };
      const res = await api.post('/invoices', payload);
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

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>Items</Text>
            <TouchableOpacity style={styles.addItemBtn} onPress={addLineItem}>
              <Ionicons name="add" size={14} color={Colors.primary} />
              <Text style={styles.addItemText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {lineItems.map((item, i) => (
            <View key={i} style={styles.lineItem}>
              <View style={styles.rowBetween}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                  placeholder="Item name"
                  placeholderTextColor={Colors.textMuted}
                  value={item.item_name}
                  onChangeText={v => updateLineItem(i, 'item_name', v)}
                />
                {lineItems.length > 1 && (
                  <TouchableOpacity onPress={() => removeLineItem(i)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Qty</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={item.quantity} onChangeText={v => updateLineItem(i, 'quantity', v)} />
                </View>
                <View style={{ flex: 1.5, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Rate (₹)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={item.rate} onChangeText={v => updateLineItem(i, 'rate', v)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>GST %</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={item.gst_rate} onChangeText={v => updateLineItem(i, 'gst_rate', v)} />
                </View>
              </View>
              <Text style={styles.itemTotal}>
                Amount: {fmt((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0) * (1 + (parseFloat(item.gst_rate) || 0) / 100))}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.totalRow}>
            <Text style={styles.totalFinalLabel}>Total Amount</Text>
            <Text style={styles.totalFinalValue}>{fmt(calcTotal())}</Text>
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
});
