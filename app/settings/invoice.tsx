import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

export default function InvoiceSettingsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    invoice_prefix: 'INV',
    invoice_start_number: '1',
    terms_conditions: 'Payment due within 30 days.',
    notes: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const res = await api.get('/businesses/me');
        const b = res.data;
        setForm({
          invoice_prefix: b.invoice_prefix || 'INV',
          invoice_start_number: String(b.invoice_start_number || 1),
          terms_conditions: b.terms_conditions || 'Payment due within 30 days.',
          notes: b.default_notes || '',
        });
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.put('/businesses/me', {
        invoice_prefix: form.invoice_prefix,
        invoice_start_number: parseInt(form.invoice_start_number) || 1,
        terms_conditions: form.terms_conditions,
        default_notes: form.notes,
      });
      Alert.alert('Success', 'Invoice settings saved');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Invoice Settings</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Invoice Numbering</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Prefix</Text>
              <TextInput style={styles.input} value={form.invoice_prefix} onChangeText={v => setForm(f => ({ ...f, invoice_prefix: v }))} placeholder="INV" placeholderTextColor={Colors.textMuted} autoCapitalize="characters" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Start Number</Text>
              <TextInput style={styles.input} value={form.invoice_start_number} onChangeText={v => setForm(f => ({ ...f, invoice_start_number: v }))} placeholder="1" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" />
            </View>
          </View>
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Preview:</Text>
            <Text style={styles.previewValue}>{form.invoice_prefix}-{form.invoice_start_number.padStart(3, '0')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Default Content</Text>
          <Text style={styles.label}>Terms & Conditions</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top', marginBottom: 14 }]} value={form.terms_conditions} onChangeText={v => setForm(f => ({ ...f, terms_conditions: v }))} placeholder="Payment terms..." placeholderTextColor={Colors.textMuted} multiline />
          <Text style={styles.label}>Default Notes</Text>
          <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="Thank you for your business!" placeholderTextColor={Colors.textMuted} multiline />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Settings</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  row: { flexDirection: 'row' },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 11, fontSize: 14, color: Colors.text, marginBottom: 0 },
  previewBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff7ed', borderRadius: 8, padding: 10, marginTop: 10 },
  previewLabel: { fontSize: 12, color: Colors.textSecondary },
  previewValue: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, padding: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
