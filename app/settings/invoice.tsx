import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Modal, FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useBottomPadding } from '../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

const THEMES = [
  { label: 'Corporate Standard (Black & White)', value: 'corporate_tax_invoice' },
  { label: 'Modern Minimalist (Teal)', value: 'theme_modern_minimalist_teal' },
  { label: 'Classic Professional (Red & Charcoal)', value: 'theme_classic_red' },
  { label: 'Elegant Luxury (Dark & Gold)', value: 'theme_elegant_dark' },
  { label: 'Vibrant Creative (Purple)', value: 'theme_vibrant_purple' }
];

const THEME_DISPLAY_NAMES: Record<string, string> = {
  corporate_tax_invoice: 'Corporate Standard (Black & White)',
  theme_modern_minimalist_teal: 'Modern Minimalist (Teal)',
  theme_classic_red: 'Classic Professional (Red & Charcoal)',
  theme_elegant_dark: 'Elegant Luxury (Dark & Gold)',
  theme_vibrant_purple: 'Vibrant Creative (Purple)',
  simple_invoice: 'Simple Invoice (Non-GST)',
  simple_invoice_period: 'Simple Invoice - Period (Non-GST)',
};

export default function InvoiceSettingsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [savingNum, setSavingNum] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [savingNongst, setSavingNongst] = useState(false);
  const [savingPref, setSavingPref] = useState(false);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const insets = useSafeAreaInsets();

  // GST/General Numbering Form State
  const [numForm, setNumForm] = useState({
    prefix: '',
    suffix: '',
    padding: 3,
    next_number: '1',
    monthly_reset_enabled: false
  });

  // Service Numbering Form State
  const [serviceForm, setServiceForm] = useState({
    prefix: 'SRV/',
    suffix: '',
    padding: 3,
    next_number: '1',
    monthly_reset_enabled: false
  });

  // Non-GST Numbering Form State
  const [nongstForm, setNongstForm] = useState({
    prefix: '',
    suffix: '',
    padding: 3,
    next_number: '1'
  });

  // App Preferences Form State
  const [prefForm, setPrefForm] = useState({
    invoice_theme: 'corporate_tax_invoice',
    declaration_label: 'Terms & Conditions',
    terms_and_conditions: '',
    show_discount: false,
    dual_address_enabled: false,
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
          terms_and_conditions: b.terms_and_conditions || '',
          show_discount: !!b.show_discount,
          dual_address_enabled: !!b.dual_address_enabled,
        });

        // Load General/GST configuration
        try {
          const nRes = await api.get(`/invoices/numbering-config?business_id=${b.id}`);
          const n = nRes.data;
          if (n) {
            setNumForm({
              prefix: n.prefix || '',
              suffix: n.suffix || '',
              padding: n.padding || 3,
              next_number: String(n.next_number || 1),
              monthly_reset_enabled: !!n.monthly_reset_enabled
            });
          }
        } catch (err) {
          console.warn('Failed to load GST numbering settings', err);
        }

        // Load Service numbering configuration
        try {
          const sRes = await api.get(`/invoices/next-number?business_id=${b.id}&invoice_type=SERVICE`);
          const s = sRes.data;
          if (s) {
            setServiceForm({
              prefix: s.prefix || '',
              suffix: s.suffix || '',
              padding: s.padding || 3,
              next_number: String(s.next_number || 1),
              monthly_reset_enabled: !!s.monthly_reset_enabled
            });
          }
        } catch (err) {
          console.warn('Failed to load Service numbering settings', err);
        }

        // Load Non-GST numbering configuration
        try {
          const ngRes = await api.get(`/invoices/next-number?business_id=${b.id}&invoice_type=NONGST`);
          const ng = ngRes.data;
          if (ng) {
            setNongstForm({
              prefix: ng.prefix || '',
              suffix: ng.suffix || '',
              padding: ng.padding || 3,
              next_number: String(ng.next_number || 1)
            });
          }
        } catch (err) {
          console.warn('Failed to load Non-GST numbering settings', err);
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
        next_number: parseInt(numForm.next_number) || 1,
        sequence_type: 'general',
        monthly_reset_enabled: numForm.monthly_reset_enabled
      });
      Alert.alert('Success', 'Invoice numbering saved');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save numbering');
    } finally {
      setSavingNum(false);
    }
  };

  const handleSaveServiceNumbering = async () => {
    if (!businessId) return;
    setSavingService(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.post(`/invoices/configure-numbering?business_id=${businessId}`, {
        prefix: serviceForm.prefix,
        suffix: serviceForm.suffix,
        padding: serviceForm.padding,
        next_number: parseInt(serviceForm.next_number) || 1,
        sequence_type: 'service',
        monthly_reset_enabled: serviceForm.monthly_reset_enabled
      });
      Alert.alert('Success', 'Service invoice numbering saved');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save Service numbering');
    } finally {
      setSavingService(false);
    }
  };

  const handleSaveNongstNumbering = async () => {
    if (!businessId) return;
    setSavingNongst(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.post(`/invoices/configure-numbering?business_id=${businessId}`, {
        prefix: nongstForm.prefix,
        suffix: nongstForm.suffix,
        padding: nongstForm.padding,
        next_number: parseInt(nongstForm.next_number) || 1,
        sequence_type: 'nongst'
      });
      Alert.alert('Success', 'Non-GST invoice numbering saved');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save Non-GST numbering');
    } finally {
      setSavingNongst(false);
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
        terms_and_conditions: prefForm.terms_and_conditions,
        show_discount: prefForm.show_discount,
        dual_address_enabled: prefForm.dual_address_enabled,
      });
      Alert.alert('Success', 'App preferences saved');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save preferences');
    } finally {
      setSavingPref(false);
    }
  };

  const currentThemeLabel = THEME_DISPLAY_NAMES[prefForm.invoice_theme] || THEMES.find(t => t.value === prefForm.invoice_theme)?.label || 'Select Theme';

  const getPreviewText = (prefix: string, next_number: string, padding: number, suffix: string, monthly_reset_enabled: boolean) => {
    const num = String(parseInt(next_number) || 1).padStart(padding, '0');
    if (monthly_reset_enabled) {
      const currentMonth = new Date().getMonth() + 1;
      const currentMonthStr = String(currentMonth).padStart(2, '0');
      return `${prefix}${currentMonthStr}/${num}${suffix}`;
    }
    return `${prefix}${num}${suffix}`;
  };

  const previewText = getPreviewText(numForm.prefix, numForm.next_number, numForm.padding, numForm.suffix, numForm.monthly_reset_enabled);
  const servicePreviewText = getPreviewText(serviceForm.prefix, serviceForm.next_number, serviceForm.padding, serviceForm.suffix, serviceForm.monthly_reset_enabled);
  const nongstPreviewText = getPreviewText(nongstForm.prefix, nongstForm.next_number, nongstForm.padding, nongstForm.suffix, false);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const bottomPadding = useBottomPadding(90);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.topbar, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Invoice Settings</Text>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={180}
        keyboardShouldPersistTaps="handled"
      >
        
        {/* SECTION 1: GST INVOICE NUMBERING */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>GST Invoice Numbering</Text>
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

          <Text style={styles.label}>Monthly Reset</Text>
          <Text style={styles.subtitle}>Reset sequence number at the start of each month (e.g. INV/07/001).</Text>
          <View style={[styles.toggleRow, { marginBottom: 16 }]}>
            {['On', 'Off'].map(opt => {
              const isActive = (numForm.monthly_reset_enabled ? 'On' : 'Off') === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.toggleBtn, isActive && styles.toggleBtnActive]}
                  onPress={() => setNumForm(f => ({ ...f, monthly_reset_enabled: opt === 'On' }))}
                >
                  <Text style={[styles.toggleBtnText, isActive && styles.toggleBtnTextActive]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

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

        {/* SECTION 2: NON-GST INVOICE NUMBERING */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Non-GST Invoice Numbering</Text>
          <Text style={styles.subtitle}>Customize how your Non-GST invoice numbers are generated. This is a separate sequence from GST invoices.</Text>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Prefix</Text>
              <TextInput 
                style={styles.input} 
                value={nongstForm.prefix} 
                onChangeText={v => setNongstForm(f => ({ ...f, prefix: v }))} 
                placeholder="e.g. NONGST-" 
                placeholderTextColor={Colors.textMuted} 
                autoCapitalize="characters" 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Suffix (optional)</Text>
              <TextInput 
                style={styles.input} 
                value={nongstForm.suffix} 
                onChangeText={v => setNongstForm(f => ({ ...f, suffix: v }))} 
                placeholder="Added after the number." 
                placeholderTextColor={Colors.textMuted} 
                autoCapitalize="characters" 
              />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Number Length</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {[1, 2, 3, 4, 5, 6].map(len => {
              const isActive = nongstForm.padding === len;
              return (
                <TouchableOpacity 
                  key={len} 
                  style={[styles.pill, isActive && styles.pillActive]} 
                  onPress={() => setNongstForm(f => ({ ...f, padding: len }))}
                >
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                    {len} {len === 1 ? 'digit' : 'digits'} (e.g. {String(1).padStart(len, '0')})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Next Non-GST Invoice Number</Text>
          <TextInput 
            style={[styles.input, { marginBottom: 16 }]} 
            value={nongstForm.next_number} 
            onChangeText={v => setNongstForm(f => ({ ...f, next_number: v.replace(/[^0-9]/g, '') }))} 
            placeholder="Starting sequence number" 
            placeholderTextColor={Colors.textMuted} 
            keyboardType="number-pad" 
          />

          <View style={styles.previewBox}>
            <Ionicons name="eye-outline" size={16} color={Colors.primary} />
            <Text style={styles.previewLabel}>Next Non-GST invoice will be: </Text>
            <Text style={styles.previewValue}>{nongstPreviewText}</Text>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚠️ Changes apply to future invoices only. Existing invoice numbers will not be affected.</Text>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSaveNongstNumbering} disabled={savingNongst}>
            {savingNongst ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Non-GST Numbering</Text>}
          </TouchableOpacity>
        </View>

        {/* SECTION 3: SERVICE INVOICE NUMBERING */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Service Invoice Numbering</Text>
          <Text style={styles.subtitle}>Customize how your service invoice numbers are generated. This is a separate sequence from GST invoices.</Text>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Prefix</Text>
              <TextInput 
                style={styles.input} 
                value={serviceForm.prefix} 
                onChangeText={v => setServiceForm(f => ({ ...f, prefix: v }))} 
                placeholder="e.g. SRV/" 
                placeholderTextColor={Colors.textMuted} 
                autoCapitalize="characters" 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Suffix (optional)</Text>
              <TextInput 
                style={styles.input} 
                value={serviceForm.suffix} 
                onChangeText={v => setServiceForm(f => ({ ...f, suffix: v }))} 
                placeholder="Added after the number." 
                placeholderTextColor={Colors.textMuted} 
                autoCapitalize="characters" 
              />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Number Length</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {[1, 2, 3, 4, 5, 6].map(len => {
              const isActive = serviceForm.padding === len;
              return (
                <TouchableOpacity 
                  key={len} 
                  style={[styles.pill, isActive && styles.pillActive]} 
                  onPress={() => setServiceForm(f => ({ ...f, padding: len }))}
                >
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                    {len} {len === 1 ? 'digit' : 'digits'} (e.g. {String(1).padStart(len, '0')})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Next Service Invoice Number</Text>
          <TextInput 
            style={[styles.input, { marginBottom: 16 }]} 
            value={serviceForm.next_number} 
            onChangeText={v => setServiceForm(f => ({ ...f, next_number: v.replace(/[^0-9]/g, '') }))} 
            placeholder="Starting sequence number" 
            placeholderTextColor={Colors.textMuted} 
            keyboardType="number-pad" 
          />

          <Text style={styles.label}>Monthly Reset</Text>
          <Text style={styles.subtitle}>Reset sequence number at the start of each month (e.g. SRV/07/001).</Text>
          <View style={[styles.toggleRow, { marginBottom: 16 }]}>
            {['On', 'Off'].map(opt => {
              const isActive = (serviceForm.monthly_reset_enabled ? 'On' : 'Off') === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.toggleBtn, isActive && styles.toggleBtnActive]}
                  onPress={() => setServiceForm(f => ({ ...f, monthly_reset_enabled: opt === 'On' }))}
                >
                  <Text style={[styles.toggleBtnText, isActive && styles.toggleBtnTextActive]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.previewBox}>
            <Ionicons name="eye-outline" size={16} color={Colors.primary} />
            <Text style={styles.previewLabel}>Next service invoice will be: </Text>
            <Text style={styles.previewValue}>{servicePreviewText}</Text>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚠️ Changes apply to future invoices only. Existing invoice numbers will not be affected.</Text>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSaveServiceNumbering} disabled={savingService}>
            {savingService ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Service Numbering</Text>}
          </TouchableOpacity>
        </View>

        {/* SECTION 4: APP PREFERENCES */}
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

          <Text style={[styles.label, { marginTop: 16 }]}>Show Discount Column</Text>
          <Text style={styles.subtitle}>Show or hide the Discount column on line items in bills.</Text>
          <View style={styles.toggleRow}>
            {['On', 'Off'].map(opt => {
              const isActive = (prefForm.show_discount ? 'On' : 'Off') === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.toggleBtn, isActive && styles.toggleBtnActive]}
                  onPress={() => setPrefForm(f => ({ ...f, show_discount: opt === 'On' }))}
                >
                  <Text style={[styles.toggleBtnText, isActive && styles.toggleBtnTextActive]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>Enable Dual Address</Text>
          <Text style={styles.subtitle}>Allow separate Billing and Shipping/Consignment addresses.</Text>
          <View style={styles.toggleRow}>
            {['On', 'Off'].map(opt => {
              const isActive = (prefForm.dual_address_enabled ? 'On' : 'Off') === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.toggleBtn, isActive && styles.toggleBtnActive]}
                  onPress={() => setPrefForm(f => ({ ...f, dual_address_enabled: opt === 'On' }))}
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

      </KeyboardAwareScrollView>

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

    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { padding: 12, gap: 12 },
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
