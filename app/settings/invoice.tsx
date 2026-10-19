import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DesignTokens } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

const THEMES = [
  { label: 'Corporate Standard (Black & White)', value: 'corporate_tax_invoice' },
  { label: 'Modern Minimalist (Teal)', value: 'theme_modern_minimalist_teal' },
  { label: 'Classic Professional (Red & Charcoal)', value: 'theme_classic_red' },
  { label: 'Elegant Luxury (Dark & Gold)', value: 'theme_elegant_dark' },
  { label: 'Vibrant Creative (Purple)', value: 'theme_vibrant_purple' },
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

type BillType = 'gst' | 'nongst' | 'service';

interface NumberingForm {
  prefix: string;
  suffix: string;
  padding: number;
  next_number: string;
  monthly_reset_enabled: boolean;
}

export default function InvoiceSettingsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [savingPref, setSavingPref] = useState(false);
  const [savingSheet, setSavingSheet] = useState(false);
  const [businessId, setBusinessId] = useState<number | null>(null);

  // Numbering states
  const [gstForm, setGstForm] = useState<NumberingForm>({
    prefix: '',
    suffix: '',
    padding: 3,
    next_number: '1',
    monthly_reset_enabled: false,
  });

  const [nongstForm, setNongstForm] = useState<NumberingForm>({
    prefix: '',
    suffix: '',
    padding: 3,
    next_number: '1',
    monthly_reset_enabled: false,
  });

  const [serviceForm, setServiceForm] = useState<NumberingForm>({
    prefix: 'SRV/',
    suffix: '',
    padding: 3,
    next_number: '1',
    monthly_reset_enabled: false,
  });

  // App preferences state
  const [prefForm, setPrefForm] = useState({
    invoice_theme: 'corporate_tax_invoice',
    declaration_label: 'Terms & Conditions',
    terms_and_conditions: '',
    show_discount: false,
    show_payment_status_on_pdf: false,
    dual_address_enabled: false,
  });

  // Snapshot of loaded preferences to track dirty state
  const [initialPrefForm, setInitialPrefForm] = useState<typeof prefForm | null>(null);

  // Modals
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  // Bottom Sheet for changing invoice numbering
  const [activeSheetType, setActiveSheetType] = useState<BillType | null>(null);
  const [sheetForm, setSheetForm] = useState<NumberingForm>({
    prefix: '',
    suffix: '',
    padding: 3,
    next_number: '1',
    monthly_reset_enabled: false,
  });
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const bRes = await api.get('/businesses/me');
        const b = bRes.data;
        setBusinessId(b.id);

        const loadedPref = {
          invoice_theme: b.invoice_theme || 'corporate_tax_invoice',
          declaration_label: b.declaration_label === 'Declaration' ? 'Declaration' : 'Terms & Conditions',
          terms_and_conditions: b.terms_and_conditions || '',
          show_discount: !!b.show_discount,
          show_payment_status_on_pdf: !!b.show_payment_status_on_pdf,
          dual_address_enabled: !!b.dual_address_enabled,
        };

        setPrefForm(loadedPref);
        setInitialPrefForm(loadedPref);

        // Load GST numbering
        try {
          const nRes = await api.get(`/invoices/numbering-config?business_id=${b.id}`);
          const n = nRes.data;
          if (n) {
            setGstForm({
              prefix: n.prefix || '',
              suffix: n.suffix || '',
              padding: n.padding || 3,
              next_number: String(n.next_number || 1),
              monthly_reset_enabled: !!n.monthly_reset_enabled,
            });
          }
        } catch (err) {
          console.warn('Failed to load GST numbering settings', err);
        }

        // Load Non-GST numbering
        try {
          const ngRes = await api.get(`/invoices/next-number?business_id=${b.id}&invoice_type=NONGST`);
          const ng = ngRes.data;
          if (ng) {
            setNongstForm({
              prefix: ng.prefix || '',
              suffix: ng.suffix || '',
              padding: ng.padding || 3,
              next_number: String(ng.next_number || 1),
              monthly_reset_enabled: false,
            });
          }
        } catch (err) {
          console.warn('Failed to load Non-GST numbering settings', err);
        }

        // Load Service numbering
        try {
          const sRes = await api.get(`/invoices/next-number?business_id=${b.id}&invoice_type=SERVICE`);
          const s = sRes.data;
          if (s) {
            setServiceForm({
              prefix: s.prefix || '',
              suffix: s.suffix || '',
              padding: s.padding || 3,
              next_number: String(s.next_number || 1),
              monthly_reset_enabled: !!s.monthly_reset_enabled,
            });
          }
        } catch (err) {
          console.warn('Failed to load Service numbering settings', err);
        }
      } catch (err) {
        console.warn('Failed to load settings', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [getToken]);

  const getPreviewText = (
    prefix: string,
    next_number: string,
    padding: number,
    suffix: string,
    monthly_reset_enabled: boolean
  ) => {
    const parsedNum = parseInt(next_number, 10);
    const validNum = isNaN(parsedNum) ? 1 : parsedNum;
    const num = String(validNum).padStart(padding, '0');
    if (monthly_reset_enabled) {
      const currentMonth = new Date().getMonth() + 1;
      const currentMonthStr = String(currentMonth).padStart(2, '0');
      return `${prefix}${currentMonthStr}/${num}${suffix}`;
    }
    return `${prefix}${num}${suffix}`;
  };

  const gstPreview = useMemo(
    () =>
      getPreviewText(
        gstForm.prefix,
        gstForm.next_number,
        gstForm.padding,
        gstForm.suffix,
        gstForm.monthly_reset_enabled
      ),
    [gstForm]
  );

  const nongstPreview = useMemo(
    () => getPreviewText(nongstForm.prefix, nongstForm.next_number, nongstForm.padding, nongstForm.suffix, false),
    [nongstForm]
  );

  const servicePreview = useMemo(
    () =>
      getPreviewText(
        serviceForm.prefix,
        serviceForm.next_number,
        serviceForm.padding,
        serviceForm.suffix,
        serviceForm.monthly_reset_enabled
      ),
    [serviceForm]
  );

  const sheetPreview = useMemo(() => {
    return getPreviewText(
      sheetForm.prefix,
      sheetForm.next_number,
      sheetForm.padding,
      sheetForm.suffix,
      activeSheetType === 'nongst' ? false : sheetForm.monthly_reset_enabled
    );
  }, [sheetForm, activeSheetType]);

  const openNumberSheet = (type: BillType) => {
    setActiveSheetType(type);
    setShowMoreOptions(false);
    if (type === 'gst') {
      setSheetForm({ ...gstForm });
    } else if (type === 'nongst') {
      setSheetForm({ ...nongstForm });
    } else {
      setSheetForm({ ...serviceForm });
    }
  };

  const handleSaveSheet = async () => {
    if (!businessId || !activeSheetType) return;
    setSavingSheet(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const parsedNum = parseInt(sheetForm.next_number, 10);
      const nextNum = isNaN(parsedNum) || parsedNum < 1 ? 1 : parsedNum;

      let seqType = 'general';
      if (activeSheetType === 'nongst') seqType = 'nongst';
      if (activeSheetType === 'service') seqType = 'service';

      await api.post(`/invoices/configure-numbering?business_id=${businessId}`, {
        prefix: sheetForm.prefix,
        suffix: sheetForm.suffix,
        padding: sheetForm.padding,
        next_number: nextNum,
        sequence_type: seqType,
        monthly_reset_enabled: activeSheetType === 'nongst' ? false : sheetForm.monthly_reset_enabled,
      });

      // Update local state
      if (activeSheetType === 'gst') {
        setGstForm({ ...sheetForm, next_number: String(nextNum) });
      } else if (activeSheetType === 'nongst') {
        setNongstForm({ ...sheetForm, next_number: String(nextNum) });
      } else {
        setServiceForm({ ...sheetForm, next_number: String(nextNum) });
      }

      Alert.alert('Success', 'Invoice numbering updated successfully.');
      setActiveSheetType(null);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save numbering.');
    } finally {
      setSavingSheet(false);
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
        show_payment_status_on_pdf: prefForm.show_payment_status_on_pdf,
        dual_address_enabled: prefForm.dual_address_enabled,
      });
      setInitialPrefForm({ ...prefForm });
      Alert.alert('Success', 'Preferences saved successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save preferences.');
    } finally {
      setSavingPref(false);
    }
  };

  const isPreferencesDirty = useMemo(() => {
    if (!initialPrefForm) return false;
    return (
      prefForm.invoice_theme !== initialPrefForm.invoice_theme ||
      prefForm.declaration_label !== initialPrefForm.declaration_label ||
      prefForm.terms_and_conditions !== initialPrefForm.terms_and_conditions ||
      prefForm.show_discount !== initialPrefForm.show_discount ||
      prefForm.show_payment_status_on_pdf !== initialPrefForm.show_payment_status_on_pdf ||
      prefForm.dual_address_enabled !== initialPrefForm.dual_address_enabled
    );
  }, [prefForm, initialPrefForm]);

  const currentThemeLabel =
    THEME_DISPLAY_NAMES[prefForm.invoice_theme] ||
    THEMES.find(t => t.value === prefForm.invoice_theme)?.label ||
    'Select Theme';

  const bottomBarPadding = Math.max(insets.bottom, 12) + 8;

  if (loading) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color={DesignTokens.brandOrange} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: DesignTokens.pageBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={DesignTokens.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoice settings</Text>
      </View>

      {/* Main Scrollable Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: INVOICE NUMBERS */}
        <Text style={styles.sectionTitle}>Invoice numbers</Text>
        <View style={styles.card}>
          {/* Row 1: GST Bill */}
          <View style={styles.numberRow}>
            <View style={styles.numberRowLeft}>
              <Text style={styles.numberRowLabel}>GST bill</Text>
              <Text style={styles.numberRowValue}>{gstPreview}</Text>
            </View>
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={() => openNumberSheet('gst')}
            >
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: Without GST */}
          <View style={styles.numberRow}>
            <View style={styles.numberRowLeft}>
              <Text style={styles.numberRowLabel}>Without GST</Text>
              <Text style={styles.numberRowValue}>{nongstPreview}</Text>
            </View>
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={() => openNumberSheet('nongst')}
            >
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Row 3: Service Bill */}
          <View style={[styles.numberRow, { borderBottomWidth: 0 }]}>
            <View style={styles.numberRowLeft}>
              <Text style={styles.numberRowLabel}>Service bill</Text>
              <Text style={styles.numberRowValue}>{servicePreview}</Text>
            </View>
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={() => openNumberSheet('service')}
            >
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 2: WHAT TO SHOW ON THE BILL */}
        <Text style={styles.sectionTitle}>What to show on the bill</Text>
        <View style={styles.card}>
          {/* Switch 1: Show discount */}
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchTitle}>Show discount</Text>
              <Text style={styles.switchHint}>A discount column on the bill</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.customSwitchTrack,
                prefForm.show_discount ? styles.switchTrackOn : styles.switchTrackOff,
              ]}
              onPress={() =>
                setPrefForm(p => ({ ...p, show_discount: !p.show_discount }))
              }
              role="switch"
              aria-checked={prefForm.show_discount}
              accessibilityLabel="Show discount"
            >
              <View
                style={[
                  styles.customSwitchThumb,
                  prefForm.show_discount ? styles.switchThumbOn : styles.switchThumbOff,
                ]}
              />
            </TouchableOpacity>
          </View>

          {/* Switch 2: Show Paid or Unpaid (Mapped to show_payment_status_on_pdf) */}
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchTitle}>Show Paid or Unpaid</Text>
              <Text style={styles.switchHint}>A stamp on the bill</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.customSwitchTrack,
                prefForm.show_payment_status_on_pdf
                  ? styles.switchTrackOn
                  : styles.switchTrackOff,
              ]}
              onPress={() =>
                setPrefForm(p => ({
                  ...p,
                  show_payment_status_on_pdf: !p.show_payment_status_on_pdf,
                }))
              }
              role="switch"
              aria-checked={prefForm.show_payment_status_on_pdf}
              accessibilityLabel="Show Paid or Unpaid"
            >
              <View
                style={[
                  styles.customSwitchThumb,
                  prefForm.show_payment_status_on_pdf
                    ? styles.switchThumbOn
                    : styles.switchThumbOff,
                ]}
              />
            </TouchableOpacity>
          </View>

          {/* Switch 3: Show delivery address */}
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchTitle}>Show delivery address</Text>
              <Text style={styles.switchHint}>Where the goods are sent</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.customSwitchTrack,
                prefForm.dual_address_enabled ? styles.switchTrackOn : styles.switchTrackOff,
              ]}
              onPress={() =>
                setPrefForm(p => ({
                  ...p,
                  dual_address_enabled: !p.dual_address_enabled,
                }))
              }
              role="switch"
              aria-checked={prefForm.dual_address_enabled}
              accessibilityLabel="Show delivery address"
            >
              <View
                style={[
                  styles.customSwitchThumb,
                  prefForm.dual_address_enabled ? styles.switchThumbOn : styles.switchThumbOff,
                ]}
              />
            </TouchableOpacity>
          </View>

          {/* Bill Look / Theme row */}
          <TouchableOpacity
            style={[styles.switchRow, { borderBottomWidth: 0 }]}
            onPress={() => setThemeModalVisible(true)}
          >
            <View style={styles.switchInfo}>
              <Text style={styles.switchTitle}>Bill look</Text>
              <Text style={styles.switchHint}>{currentThemeLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={DesignTokens.mutedText} />
          </TouchableOpacity>
        </View>

        {/* SECTION 3: HEADING FOR THE NOTE */}
        <Text style={styles.sectionTitle}>Heading for the note</Text>
        <View style={styles.headingButtonsRow}>
          {['Declaration', 'Terms & Conditions'].map(item => {
            const isSelected = prefForm.declaration_label === item;
            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.headingButton,
                  isSelected ? styles.headingButtonActive : styles.headingButtonInactive,
                ]}
                onPress={() => setPrefForm(p => ({ ...p, declaration_label: item }))}
              >
                <Text
                  style={[
                    styles.headingButtonText,
                    isSelected ? styles.headingButtonTextActive : styles.headingButtonTextInactive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* SECTION 4: NOTE AT THE BOTTOM */}
        <Text style={styles.sectionTitle}>Note at the bottom</Text>
        <View style={styles.card}>
          <Text style={styles.noteLabel}>Printed on every bill</Text>
          <TextInput
            style={styles.textArea}
            value={prefForm.terms_and_conditions}
            onChangeText={v => setPrefForm(p => ({ ...p, terms_and_conditions: v }))}
            placeholder={`Enter your ${prefForm.declaration_label.toLowerCase()} here...`}
            placeholderTextColor={DesignTokens.lightText}
            multiline
            numberOfLines={4}
          />
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar (OUTSIDE ScrollView) */}
      <View style={[styles.stickyBottomBar, { paddingBottom: bottomBarPadding }]}>
        <TouchableOpacity
          style={[
            styles.saveChangesBtn,
            (!isPreferencesDirty || savingPref) && styles.saveChangesBtnDisabled,
          ]}
          onPress={handleSavePreferences}
          disabled={!isPreferencesDirty || savingPref}
        >
          {savingPref ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveChangesBtnText}>Save changes</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* BOTTOM SHEET: NUMBERING CONFIG */}
      <Modal
        visible={activeSheetType !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveSheetType(null)}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetContainer}
          >
            {/* Handle bar */}
            <View style={styles.sheetHandle} />

            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>
                  {activeSheetType === 'gst'
                    ? 'GST bill number'
                    : activeSheetType === 'nongst'
                    ? 'Without GST number'
                    : 'Service bill number'}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  How your next bill will be numbered
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveSheetType(null)}
                style={styles.sheetCloseBtn}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={DesignTokens.ink} />
              </TouchableOpacity>
            </View>

            {/* Sheet Scroll Body */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Preview Box */}
              <View style={styles.previewBox}>
                <Text style={styles.previewSub}>Your next bill will be</Text>
                <Text style={styles.previewNumber}>{sheetPreview}</Text>
              </View>

              {/* Starts with */}
              <View style={styles.sheetFieldGroup}>
                <Text style={styles.fieldLabel}>Starts with</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={sheetForm.prefix}
                  onChangeText={v => setSheetForm(f => ({ ...f, prefix: v }))}
                  placeholder="e.g. INV-, NG-, SRV/"
                  placeholderTextColor={DesignTokens.lightText}
                  autoCapitalize="characters"
                />
              </View>

              {/* Next number stepper */}
              <View style={styles.sheetFieldGroup}>
                <Text style={styles.fieldLabel}>Next number</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      const cur = parseInt(sheetForm.next_number, 10) || 1;
                      setSheetForm(f => ({ ...f, next_number: String(Math.max(1, cur - 1)) }));
                    }}
                    accessibilityLabel="Less"
                  >
                    <Ionicons name="remove" size={20} color={DesignTokens.ink} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.stepperInput}
                    value={sheetForm.next_number}
                    onChangeText={v => setSheetForm(f => ({ ...f, next_number: v.replace(/[^0-9]/g, '') }))}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      const cur = parseInt(sheetForm.next_number, 10) || 1;
                      setSheetForm(f => ({ ...f, next_number: String(cur + 1) }));
                    }}
                    accessibilityLabel="More"
                  >
                    <Ionicons name="add" size={20} color={DesignTokens.ink} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Changes warning */}
              <Text style={styles.sheetWarningText}>
                Changes apply to future bills only.
              </Text>

              {/* More options collapsible toggle */}
              <TouchableOpacity
                style={styles.moreOptionsBtn}
                onPress={() => setShowMoreOptions(prev => !prev)}
              >
                <Text style={styles.moreOptionsBtnText}>More options</Text>
                <Ionicons
                  name={showMoreOptions ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={DesignTokens.mutedText}
                />
              </TouchableOpacity>
              <Text style={styles.moreOptionsHelperText}>
                Ending text, number of digits, start again every month.
              </Text>

              {/* Collapsed options */}
              {showMoreOptions && (
                <View style={styles.moreOptionsPanel}>
                  {/* Suffix */}
                  <View style={styles.sheetFieldGroup}>
                    <Text style={styles.fieldLabel}>Ending text (suffix)</Text>
                    <TextInput
                      style={styles.sheetInput}
                      value={sheetForm.suffix}
                      onChangeText={v => setSheetForm(f => ({ ...f, suffix: v }))}
                      placeholder="e.g. /2026"
                      placeholderTextColor={DesignTokens.lightText}
                      autoCapitalize="characters"
                    />
                  </View>

                  {/* Number Length (padding) */}
                  <View style={styles.sheetFieldGroup}>
                    <Text style={styles.fieldLabel}>Number of digits</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {[1, 2, 3, 4, 5, 6].map(len => {
                        const isActive = sheetForm.padding === len;
                        return (
                          <TouchableOpacity
                            key={len}
                            style={[styles.paddingPill, isActive && styles.paddingPillActive]}
                            onPress={() => setSheetForm(f => ({ ...f, padding: len }))}
                          >
                            <Text style={[styles.paddingPillText, isActive && styles.paddingPillTextActive]}>
                              {len} {len === 1 ? 'digit' : 'digits'} ({String(1).padStart(len, '0')})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Monthly reset (Only for GST and Service bills!) */}
                  {activeSheetType !== 'nongst' && (
                    <View style={styles.switchRowSheet}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.switchTitle}>Start again every month</Text>
                        <Text style={styles.switchHint}>
                          Reset number at the start of each month (e.g. INV/10/001)
                        </Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.customSwitchTrack,
                          sheetForm.monthly_reset_enabled ? styles.switchTrackOn : styles.switchTrackOff,
                        ]}
                        onPress={() =>
                          setSheetForm(f => ({
                            ...f,
                            monthly_reset_enabled: !f.monthly_reset_enabled,
                          }))
                        }
                      >
                        <View
                          style={[
                            styles.customSwitchThumb,
                            sheetForm.monthly_reset_enabled ? styles.switchThumbOn : styles.switchThumbOff,
                          ]}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Sheet Sticky Save Button */}
            <View style={[styles.sheetBottomBar, { paddingBottom: bottomBarPadding }]}>
              <TouchableOpacity
                style={styles.sheetSaveBtn}
                onPress={handleSaveSheet}
                disabled={savingSheet}
              >
                {savingSheet ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.sheetSaveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* THEME PICKER MODAL */}
      <Modal
        visible={themeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.themeModalSheet, { paddingBottom: Math.max(insets.bottom, 12) + 20 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Bill Look</Text>
              <TouchableOpacity
                onPress={() => setThemeModalVisible(false)}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={24} color={DesignTokens.ink} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={THEMES}
              keyExtractor={item => item.value}
              renderItem={({ item }) => {
                const isSelected = prefForm.invoice_theme === item.value;
                return (
                  <TouchableOpacity
                    style={styles.themeItemRow}
                    onPress={() => {
                      setPrefForm(p => ({ ...p, invoice_theme: item.value }));
                      setThemeModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.themeItemText,
                        isSelected && styles.themeItemTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color={DesignTokens.brandOrange} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DesignTokens.pageBackground,
  },
  header: {
    height: 64 + 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: DesignTokens.lines,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: DesignTokens.ink,
    marginLeft: 4,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: DesignTokens.ink,
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: DesignTokens.lines,
    borderRadius: DesignTokens.cardRadius,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: DesignTokens.lines,
  },
  numberRowLeft: {
    flex: 1,
    gap: 2,
  },
  numberRowLabel: {
    fontSize: 15,
    color: DesignTokens.mutedText,
  },
  numberRowValue: {
    fontSize: 17,
    fontWeight: '700',
    color: DesignTokens.ink,
  },
  changeBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: DesignTokens.brandOrange,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: DesignTokens.orangeText,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: DesignTokens.lines,
  },
  switchInfo: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DesignTokens.ink,
  },
  switchHint: {
    fontSize: 14,
    color: DesignTokens.mutedText,
  },
  customSwitchTrack: {
    width: 56,
    height: 32,
    borderRadius: 999,
    padding: 4,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: DesignTokens.brandOrange,
  },
  switchTrackOff: {
    backgroundColor: DesignTokens.switchOff,
  },
  customSwitchThumb: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  switchThumbOff: {
    alignSelf: 'flex-start',
  },
  headingButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  headingButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headingButtonActive: {
    backgroundColor: DesignTokens.brandOrange,
  },
  headingButtonInactive: {
    borderWidth: 1,
    borderColor: DesignTokens.inputBorder,
    backgroundColor: '#FFFFFF',
  },
  headingButtonText: {
    fontSize: 16,
  },
  headingButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  headingButtonTextInactive: {
    color: DesignTokens.ink,
    fontWeight: '600',
  },
  noteLabel: {
    fontSize: 14,
    color: DesignTokens.mutedText,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  textArea: {
    margin: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: DesignTokens.inputBorder,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    color: DesignTokens.ink,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  stickyBottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: DesignTokens.lines,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  saveChangesBtn: {
    width: '100%',
    height: 56,
    borderRadius: DesignTokens.cardRadius,
    backgroundColor: DesignTokens.brandOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveChangesBtnDisabled: {
    opacity: 0.45,
  },
  saveChangesBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 10,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: DesignTokens.lines,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: DesignTokens.ink,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: DesignTokens.mutedText,
    marginTop: 1,
  },
  sheetCloseBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContent: {
    padding: 20,
    gap: 14,
  },
  previewBox: {
    padding: 16,
    borderRadius: DesignTokens.cardRadius,
    backgroundColor: DesignTokens.orangeTint,
    gap: 2,
  },
  previewSub: {
    fontSize: 14,
    fontWeight: '500',
    color: DesignTokens.mutedText,
  },
  previewNumber: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
    color: DesignTokens.orangeText,
  },
  sheetFieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: DesignTokens.ink,
  },
  sheetInput: {
    width: '100%',
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: DesignTokens.inputBorder,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: DesignTokens.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderColor: DesignTokens.inputBorder,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: DesignTokens.inputBorder,
    borderRadius: 10,
    fontSize: 20,
    fontWeight: '800',
    color: DesignTokens.ink,
  },
  sheetWarningText: {
    fontSize: 13,
    color: DesignTokens.lightText,
    paddingHorizontal: 2,
    marginTop: -4,
  },
  moreOptionsBtn: {
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: DesignTokens.lines,
    borderRadius: DesignTokens.cardRadius,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreOptionsBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  moreOptionsHelperText: {
    fontSize: 13,
    color: DesignTokens.lightText,
    paddingHorizontal: 4,
    marginTop: -8,
  },
  moreOptionsPanel: {
    gap: 14,
    paddingTop: 6,
  },
  paddingPill: {
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: DesignTokens.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paddingPillActive: {
    backgroundColor: DesignTokens.orangeTint,
    borderColor: DesignTokens.brandOrange,
  },
  paddingPillText: {
    fontSize: 13,
    color: DesignTokens.mutedText,
    fontWeight: '500',
  },
  paddingPillTextActive: {
    color: DesignTokens.brandOrange,
    fontWeight: '700',
  },
  switchRowSheet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sheetBottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: DesignTokens.lines,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetSaveBtn: {
    width: '100%',
    height: 56,
    borderRadius: DesignTokens.cardRadius,
    backgroundColor: DesignTokens.brandOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSaveBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  themeModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingTop: 10,
  },
  themeItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: DesignTokens.lines,
  },
  themeItemText: {
    fontSize: 15,
    color: DesignTokens.ink,
  },
  themeItemTextSelected: {
    color: DesignTokens.orangeText,
    fontWeight: '700',
  },
});
