import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, Modal,
  FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

const THEMES = [
  { label: 'Corporate Standard (Black & White)', value: 'corporate_tax_invoice' },
  { label: 'Modern Minimalist (Teal)', value: 'theme_modern_minimalist_teal' },
  { label: 'Classic Professional (Red & Charcoal)', value: 'theme_classic_red' },
  { label: 'Elegant Luxury (Dark & Gold)', value: 'theme_elegant_dark' },
  { label: 'Vibrant Creative (Purple)', value: 'theme_vibrant_purple' },
  { label: 'Simple Invoice (Non-GST)', value: 'simple_invoice' },
  { label: 'Simple Invoice - Period (Non-GST)', value: 'simple_invoice_period' }
];

export default function InvoiceSettingsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [savingNum, setSavingNum] = useState(false);
  const [savingPref, setSavingPref] = useState(false);
  const [businessId, setBusinessId] = useState<number | null>(null);

  // Numbering Form State
  const [numForm, setNumForm] = useState({
    prefix: '',
    suffix: '',
    padding: 3,
    next_number: '1'
  });

  // App Preferences Form State
  const [prefForm, setPrefForm] = useState({
    invoice_theme: 'corporate_tax_invoice',
    declaration_label: 'Terms & Conditions',
    terms_and_conditions: ''
  });

  const [themeModalVisible, setThemeModalVisible] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const bRes = await api.get('/businesses/me');
        const b = bRes.data;
        setBusinessId(b.id);
        
        setPrefForm({
          invoice_theme: b.invoice_theme || 'corporate_tax_invoice',
          declaration_label: b.declaration_label === 'Declaration' ? 'Declaration' : 'Terms & Conditions',
          terms_and_conditions: b.terms_and_conditions || ''
        });

        const nRes = await api.get(`/invoices/numbering-config?business_id=${b.id}`);
        const n = nRes.data;
        if (n) {
          setNumForm({
            prefix: n.prefix || '',
            suffix: n.suffix || '',
            padding: n.padding || 3,
            next_number: String(n.next_number || 1)
          });
        }
      } catch (err) {
        console.warn('Failed to load settings', err);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSaveNumbering = async () => {
    if (!businessId) return;
    setSavingNum(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.post(`/invoices/configure-numbering?business_id=${businessId}`, {
        prefix: numForm.prefix,
        suffix: numForm.suffix,
        padding: numForm.padding,
        next_number: parseInt(numForm.next_number) || 1
      });
      Alert.alert('Success', 'Invoice numbering saved');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save numbering');
    } finally {
      setSavingNum(false);
    }
  };

  const handleSavePreferences = async () => {
    setSavingPref(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.put('/businesses/settings', {
        invoice_theme: prefForm.invoice_theme,
        declaration_label: prefForm.declaration_label,
        terms_and_conditions: prefForm.terms_and_conditions
      });
      Alert.alert('Success', 'App preferences saved');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save preferences');
    } finally {
      setSavingPref(false);
    }
  };

  const currentThemeLabel = THEMES.find(t => t.value === prefForm.invoice_theme)?.label || 'Select Theme';
  const previewText = `${numForm.prefix}${String(parseInt(numForm.next_number) || 1).padStart(numForm.padding, '0')}${numForm.suffix}`;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Invoice Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        
        {/* SECTION 1: INVOICE NUMBERING */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Invoice Numbering</Text>
          <Text style={styles.subtitle}>Customize how your invoice numbers are generated. Changes apply to future invoices only.</Text>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Prefix</Text>
              <TextInput 
                style={styles.input} 
                value={numForm.prefix} 
                onChangeText={v => setNumForm(f => ({ ...f, prefix: v }))} 
                placeholder="e.g. INV-, S, 2024-25/" 
                placeholderTextColor={Colors.textMuted} 
                autoCapitalize="characters" 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Suffix (optional)</Text>
              <TextInput 
                style={styles.input} 
                value={numForm.suffix} 
                onChangeText={v => setNumForm(f => ({ ...f, suffix: v }))} 
                placeholder="Added after the number." 
                placeholderTextColor={Colors.textMuted} 
                autoCapitalize="characters" 
              />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Number Length</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {[1, 2, 3, 4, 5, 6].map(len => {
              const isActive = numForm.padding === len;
              return (
                <TouchableOpacity 
                  key={len} 
                  style={[styles.pill, isActive && styles.pillActive]} 
                  onPress={() => setNumForm(f => ({ ...f, padding: len }))}
                >
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                    {len} {len === 1 ? 'digit' : 'digits'} (e.g. {String(1).padStart(len, '0')})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Next Invoice Number</Text>
          <TextInput 
            style={[styles.input, { marginBottom: 16 }]} 
            value={numForm.next_number} 
            onChangeText={v => setNumForm(f => ({ ...f, next_number: v.replace(/[^0-9]/g, '') }))} 
            placeholder="Starting sequence number" 
            placeholderTextColor={Colors.textMuted} 
            keyboardType="number-pad" 
          />

          <View style={styles.previewBox}>
            <Ionicons name="eye-outline" size={16} color={Colors.primary} />
            <Text style={styles.previewLabel}>Next invoice will be: </Text>
            <Text style={styles.previewValue}>{previewText}</Text>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚠️ Changes apply to future invoices only. Existing invoice numbers will not be affected.</Text>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSaveNumbering} disabled={savingNum}>
            {savingNum ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Invoice Numbering</Text>}
          </TouchableOpacity>
        </View>

        {/* SECTION 2: APP PREFERENCES */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>App Preferences</Text>
          
          <Text style={styles.label}>Invoice Theme</Text>
          <Text style={styles.subtitle}>Choose from our curated themes for PDF exports.</Text>
          <TouchableOpacity style={styles.selectorBtn} onPress={() => setThemeModalVisible(true)}>
            <Text style={styles.selectorBtnText}>{currentThemeLabel}</Text>
            <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 16 }]}>Section Heading on Invoice</Text>
          <Text style={styles.subtitle}>Choose how this section appears on your invoices.</Text>
          <View style={styles.toggleRow}>
            {['Declaration', 'Terms & Conditions'].map(opt => {
              const isActive = prefForm.declaration_label === opt;
              return (
                <TouchableOpacity 
                  key={opt} 
                  style={[styles.toggleBtn, isActive && styles.toggleBtnActive]} 
                  onPress={() => setPrefForm(f => ({ ...f, declaration_label: opt }))}
                >
                  <Text style={[styles.toggleBtnText, isActive && styles.toggleBtnTextActive]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>{prefForm.declaration_label}</Text>
          <TextInput 
            style={[styles.input, { height: 100, textAlignVertical: 'top', marginBottom: 6 }]} 
            value={prefForm.terms_and_conditions} 
            onChangeText={v => setPrefForm(f => ({ ...f, terms_and_conditions: v }))} 
            placeholder={`Enter your ${prefForm.declaration_label.toLowerCase()} here...`} 
            placeholderTextColor={Colors.textMuted} 
            multiline 
          />
          <Text style={styles.fieldSubtitle}>This will replace the default terms on all your bills.</Text>

          <TouchableOpacity style={[styles.submitBtn, { marginTop: 16 }]} onPress={handleSavePreferences} disabled={savingPref}>
            {savingPref ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Preferences</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Theme Modal */}
      <Modal visible={themeModalVisible} animationType="slide" transparent={true} onRequestClose={() => setThemeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Theme</Text>
              <TouchableOpacity onPress={() => setThemeModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={THEMES}
              keyExtractor={item => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.modalItem} 
                  onPress={() => {
                    setPrefForm(f => ({ ...f, invoice_theme: item.value }));
                    setThemeModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, prefForm.invoice_theme === item.value && styles.modalItemTextActive]}>
                    {item.label}
                  </Text>
                  {prefForm.invoice_theme === item.value && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  row: { flexDirection: 'row' },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 11, fontSize: 14, color: Colors.text, marginBottom: 0 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f1f5f9', borderRadius: Radius.sm, marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  pillActive: { backgroundColor: '#fff7ed', borderColor: Colors.primary },
  pillText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  pillTextActive: { color: Colors.primary, fontWeight: '600' },
  previewBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff7ed', borderRadius: Radius.sm, padding: 12, marginBottom: 12 },
  previewLabel: { fontSize: 13, color: Colors.textSecondary },
  previewValue: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  warningBox: { backgroundColor: '#fef2f2', padding: 12, borderRadius: Radius.sm, marginBottom: 16 },
  warningText: { fontSize: 12, color: '#b91c1c', lineHeight: 18 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, padding: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  selectorBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 12 },
  selectorBtnText: { fontSize: 14, color: Colors.text },
  toggleRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: Radius.sm, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.sm - 2 },
  toggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  toggleBtnText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  toggleBtnTextActive: { color: Colors.text, fontWeight: '600' },
  fieldSubtitle: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingBottom: 30, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  modalItemText: { fontSize: 15, color: Colors.text },
  modalItemTextActive: { color: Colors.primary, fontWeight: '600' },
});

