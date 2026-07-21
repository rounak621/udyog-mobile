import { useAuth, useUser } from '@clerk/clerk-expo';
import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Modal, FlatList, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Colors } from '../constants/theme';
import { api, setAuthToken } from '../services/api';
import { useBusiness } from '../context/BusinessContext';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

export default function BusinessSetupScreen() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setHasBusiness } = useBusiness();

  const [name, setName] = useState('');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstNumber, setGstNumber] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.emailAddresses?.[0]?.emailAddress || '');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  // GST Verification state
  const [verifyingGst, setVerifyingGst] = useState(false);
  const [gstPreview, setGstPreview] = useState<{
    trade_name?: string;
    legal_name?: string;
    address?: string;
    state?: string;
    pincode?: string;
    status?: string;
    is_active?: boolean;
  } | null>(null);
  const [gstError, setGstError] = useState<string | null>(null);

  const [showStatePicker, setShowStatePicker] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  const onChangeName = useCallback((text: string) => setName(text), []);
  const onChangeGstNumber = useCallback((text: string) => setGstNumber(text), []);
  const onChangeCity = useCallback((text: string) => setCity(text), []);
  const onChangePhone = useCallback((text: string) => setPhone(text), []);
  const onChangeEmail = useCallback((text: string) => setEmail(text), []);
  const onChangeAddress = useCallback((text: string) => setAddress(text), []);

  const handleVerifyGST = async () => {
    const clean = gstNumber.trim().toUpperCase();
    if (clean.length !== 15) {
      Alert.alert('Error', 'GSTIN must be exactly 15 characters long.');
      return;
    }

    setVerifyingGst(true);
    setGstPreview(null);
    setGstError(null);
    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await api.get(`/gst/verify?gstin=${clean}`);
      setGstPreview(res.data);
    } catch (err: any) {
      console.log('GST verify error in setup:', err);
      const msg = err.response?.data?.detail || 'Invalid GST number or verification failed.';
      setGstError(msg);
    } finally {
      setVerifyingGst(false);
    }
  };

  const handleUseGSTDetails = () => {
    if (!gstPreview) return;
    const { trade_name, legal_name, address: gstAddr, state: gstState } = gstPreview;

    const finalName = trade_name || legal_name || '';

    const matchedState = INDIAN_STATES.find(
      s => s.toLowerCase().trim() === (gstState || '').toLowerCase().trim()
    ) || gstState || '';

    const parts = (gstAddr || '').split(',').map((p: string) => p.trim());
    const extractedCity = parts.length >= 3 ? parts[parts.length - 3] : '';

    if (finalName) setName(finalName);
    if (gstAddr) setAddress(gstAddr);
    if (matchedState) setState(matchedState);
    if (extractedCity) setCity(extractedCity);

    setGstPreview(null);
  };

  const handleDiscardGSTDetails = () => {
    setGstPreview(null);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Business name is required'); return; }
    if (gstEnabled && !gstNumber.trim()) { Alert.alert('Error', 'GSTIN is required when GST is enabled'); return; }
    if (gstEnabled && gstNumber.trim().length !== 15) { Alert.alert('Error', 'GSTIN must be exactly 15 characters'); return; }
    if (!state.trim()) { Alert.alert('Error', 'State is required'); return; }
    if (!city.trim()) { Alert.alert('Error', 'City is required'); return; }
    if (!phone.trim()) { Alert.alert('Error', 'Phone number is required'); return; }
    if (!email.trim()) { Alert.alert('Error', 'Email address is required'); return; }
    if (!address.trim()) { Alert.alert('Error', 'Business address is required'); return; }

    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      // Step 1: Force role update silently if not already USER
      try {
        await api.put('/users/me/role', { role: 'USER' });
      } catch (roleErr) {
        console.log('Silent role setup error in setup:', roleErr);
      }

      // Step 2: Create business record
      const payload = {
        name: name.trim(),
        gst_enabled: gstEnabled,
        gst_number: gstEnabled ? gstNumber.trim().toUpperCase() : null,
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim(),
        state: state.trim(),
        address_line1: address.trim(),
        business_type: 'individual'
      };

      await api.post('/businesses/', payload);
      
      // Update shared state to prevent AuthGuard redirect loop
      setHasBusiness(true);
      
      // Navigate to tabs
      router.replace('/(tabs)');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        const fieldNames: Record<string, string> = {
          gst_number: 'GST Number',
          phone: 'Phone Number',
          email: 'Business Email',
          name: 'Business Name',
          city: 'City',
          state: 'State',
          address_line1: 'Business Address',
        };
        const messages = detail.map((e: any) => {
          const field = e.loc?.[e.loc.length - 1];
          const label = fieldNames[field] || field;
          return `${label}: ${e.msg}`;
        });
        Alert.alert('Please Check Your Details', messages.join('\n'));
      } else if (typeof detail === 'string') {
        Alert.alert('Setup Failed', detail);
      } else {
        Alert.alert('Setup Failed', err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FDF8F3' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDF8F3" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.logoIcon}>
          <Ionicons name="document-text" size={16} color="#fff" />
        </View>
        <Text style={styles.logoText}>Udyog</Text>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        enableOnAndroid={true}
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.title}>Set up your business</Text>
          <Text style={styles.subtitle}>This details will appear on your tax invoices.</Text>
        </View>

        {/* Form Container */}
        <View style={styles.card}>
          {/* Business Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Business Name *</Text>
            <TextInput
              blurOnSubmit={false}
              style={styles.input}
              placeholder="e.g. Ravi Traders"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={onChangeName}
            />
          </View>

          {/* GST Switch */}
          <View style={styles.gstToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.gstToggleTitle}>GST Registered?</Text>
              <Text style={styles.gstToggleSub}>Enable if you have a GST number</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setGstEnabled(!gstEnabled)}
              style={[
                styles.switchTrack,
                gstEnabled ? styles.switchTrackActive : styles.switchTrackInactive
              ]}
            >
              <View style={[
                styles.switchThumb,
                gstEnabled ? styles.switchThumbActive : styles.switchThumbInactive
              ]} />
            </TouchableOpacity>
          </View>

          {/* GSTIN Field */}
          {gstEnabled && (
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>GSTIN *</Text>
              <TextInput
                blurOnSubmit={false}
                style={styles.input}
                placeholder="27AAAAA0000A1Z5"
                placeholderTextColor="#94A3B8"
                value={gstNumber}
                onChangeText={(text) => {
                  const clean = text.replace(/\s/g, '').toUpperCase();
                  onChangeGstNumber(clean);
                  if (clean.length !== 15) {
                    setGstPreview(null);
                    setGstError(null);
                  }
                }}
                maxLength={15}
                autoCapitalize="characters"
              />

              {gstNumber.length === 15 && !gstPreview && !verifyingGst && (
                <TouchableOpacity style={styles.fetchGstBtn} onPress={handleVerifyGST}>
                  <Ionicons name="search" size={14} color="#F97316" style={{ marginRight: 4 }} />
                  <Text style={styles.fetchGstBtnText}>Fetch Details</Text>
                </TouchableOpacity>
              )}

              {verifyingGst && (
                <View style={styles.gstStatusContainer}>
                  <ActivityIndicator color="#F97316" size="small" />
                  <Text style={styles.gstStatusText}>Fetching GST details...</Text>
                </View>
              )}

              {gstError && (
                <View style={styles.gstErrorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.gstErrorText}>{gstError}</Text>
                </View>
              )}

              {gstPreview && (
                <View style={[styles.gstPreviewCard, !gstPreview.is_active && styles.gstPreviewCardInactive]}>
                  <Text style={styles.gstPreviewHeader}>GSTIN Details Preview</Text>
                  
                  {!gstPreview.is_active && (
                    <View style={styles.warningBanner}>
                      <Ionicons name="warning" size={14} color="#B91C1C" style={{ marginRight: 6 }} />
                      <Text style={styles.warningText}>Status is NOT Active ({gstPreview.status})</Text>
                    </View>
                  )}

                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Trade Name:</Text>
                    <Text style={styles.previewValue}>{gstPreview.trade_name || '—'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Legal Name:</Text>
                    <Text style={styles.previewValue}>{gstPreview.legal_name || '—'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Address:</Text>
                    <Text style={styles.previewValue}>{gstPreview.address || '—'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>State:</Text>
                    <Text style={styles.previewValue}>{gstPreview.state || '—'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Pincode:</Text>
                    <Text style={styles.previewValue}>{gstPreview.pincode || '—'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Status:</Text>
                    <Text style={[styles.previewValue, gstPreview.is_active ? styles.statusActive : styles.statusInactive]}>
                      {gstPreview.status || 'Unknown'}
                    </Text>
                  </View>

                  <View style={styles.previewActions}>
                    <TouchableOpacity style={styles.useThisBtn} onPress={handleUseGSTDetails}>
                      <Text style={styles.useThisText}>Use This</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.discardBtn} onPress={handleDiscardGSTDetails}>
                      <Text style={styles.discardText}>Discard</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* State */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>State *</Text>
            <TouchableOpacity
              style={styles.selectInput}
              onPress={() => {
                setStateSearch('');
                setShowStatePicker(true);
              }}
            >
              <Text style={{ fontSize: 14, color: state ? '#0F172A' : '#94A3B8', flexShrink: 1 }} textBreakStrategy="simple">
                {state || 'Select State'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* City */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>City *</Text>
            <TextInput
              blurOnSubmit={false}
              style={styles.input}
              placeholder="e.g. Mumbai"
              placeholderTextColor="#94A3B8"
              value={city}
              onChangeText={onChangeCity}
            />
          </View>

          {/* Phone */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              blurOnSubmit={false}
              style={styles.input}
              placeholder="10-digit mobile number"
              placeholderTextColor="#94A3B8"
              value={phone}
              onChangeText={onChangePhone}
              keyboardType="numeric"
              maxLength={15}
            />
          </View>

          {/* Business Email */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Business Email *</Text>
            <TextInput
              blurOnSubmit={false}
              style={styles.input}
              placeholder="business@email.com"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={onChangeEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Business Address */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Business Address *</Text>
            <TextInput
              blurOnSubmit={false}
              multiline
              numberOfLines={3}
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Full shop or office address"
              placeholderTextColor="#94A3B8"
              value={address}
              onChangeText={onChangeAddress}
            />
          </View>
        </View>

        {/* Complete Setup Action */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Complete Setup →</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* State Picker Modal */}
      <Modal
        visible={showStatePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setShowStatePicker(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search states..."
                placeholderTextColor="#94A3B8"
                value={stateSearch}
                onChangeText={setStateSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={INDIAN_STATES.filter(s => s.toLowerCase().includes(stateSearch.toLowerCase()))}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setState(item);
                    setShowStatePicker(false);
                  }}
                >
                  <Text style={styles.modalItemName}>{item}</Text>
                  {state === item && <Ionicons name="checkmark" size={18} color="#F97316" />}
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A'
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 16,
    marginBottom: 24,
  },
  fieldContainer: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  selectInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gstToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  gstToggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  gstToggleSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#F97316',
  },
  switchTrackInactive: {
    backgroundColor: '#CBD5E1',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  switchThumbInactive: {
    alignSelf: 'flex-start',
  },
  submitBtn: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  submitBtnText: {
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  modalItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
  },
  fetchGstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 8,
  },
  fetchGstBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F97316',
  },
  gstStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
  },
  gstStatusText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  gstErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  gstErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  gstPreviewCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    gap: 8,
  },
  gstPreviewCardInactive: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
  },
  gstPreviewHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    borderBottomWidth: 0.5,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 4,
    marginBottom: 2,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  warningText: {
    fontSize: 11,
    color: '#B91C1C',
    fontWeight: '600',
    marginLeft: 6,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  previewLabel: {
    width: 90,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  previewValue: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '500',
  },
  statusActive: {
    color: '#16A34A',
    fontWeight: '700',
  },
  statusInactive: {
    color: '#DC2626',
    fontWeight: '700',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  useThisBtn: {
    flex: 1,
    backgroundColor: '#F97316',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  useThisText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  discardBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  discardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
});
