import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Platform, Modal, FlatList, KeyboardAvoidingView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useBottomPadding } from '../../components/ui/SafeLayout';
import { Colors } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

export default function CreatePartyScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, name: prefillName, phone: prefillPhone, gstin: prefillGstin, state: prefillState, partyType: prefillPartyType } = useLocalSearchParams<{
    id?: string;
    name?: string;
    phone?: string;
    gstin?: string;
    state?: string;
    partyType?: 'customer' | 'supplier' | 'both';
  }>();
  
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [name, setName] = useState(prefillName || '');
  const [phone, setPhone] = useState(prefillPhone || '');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState(prefillGstin || '');
  const [state, setState] = useState(prefillState || '');
  const [address, setAddress] = useState('');
  const [consignmentAddress, setConsignmentAddress] = useState('');
  const [partyType, setPartyType] = useState<'customer' | 'supplier' | 'both'>(prefillPartyType || 'customer');
  const [saving, setSaving] = useState(false);

  const [showStatePicker, setShowStatePicker] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  // GST Verification States
  const [fetchingGst, setFetchingGst] = useState(false);
  const [gstPreview, setGstPreview] = useState<any>(null);
  const [gstError, setGstError] = useState<string | null>(null);

  // Stable callbacks for input fields to avoid focus loss
  const onChangeName = useCallback((text: string) => setName(text), []);
  const onChangePhone = useCallback((text: string) => setPhone(text), []);
  const onChangeEmail = useCallback((text: string) => setEmail(text), []);
  const onChangeGstin = useCallback((text: string) => setGstin(text), []);
  const onChangeAddress = useCallback((text: string) => setAddress(text), []);
  const onChangeConsignmentAddress = useCallback((text: string) => setConsignmentAddress(text), []);

  useEffect(() => {
    const loadBusinessAndParty = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const bizRes = await api.get('/businesses/me');
        const bId = bizRes.data.id;
        setBusinessId(bId);

        if (id) {
          const res = await api.get(`/customers/${id}?business_id=${bId}`);
          const p = res.data;
          setName(p.name || '');
          setPhone(p.phone || '');
          setEmail(p.email || '');
          setGstin(p.gstin || '');
          setState(p.state || '');
          setAddress(p.address || '');
          setConsignmentAddress(p.consignment_address || '');
          setPartyType(p.party_type?.toLowerCase() || 'customer');
        }
      } catch (err) {
        console.log('Error loading business/party in edit:', err);
      }
    };
    loadBusinessAndParty();
  }, [id]);

  const fetchGstDetails = async () => {
    if (gstin.length !== 15) return;
    setFetchingGst(true);
    setGstError(null);
    setGstPreview(null);
    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await api.get(`/gst/verify?gstin=${gstin}`);
      setGstPreview(res.data);
    } catch (err: any) {
      console.log('GST verify error:', err);
      const msg = err.response?.data?.detail || 'Invalid GST number or verification failed.';
      setGstError(msg);
    } finally {
      setFetchingGst(false);
    }
  };

  const useGstDetails = () => {
    if (!gstPreview) return;
    setName(gstPreview.trade_name || gstPreview.legal_name || '');
    setAddress(gstPreview.address || '');
    if (gstPreview.state) {
      const matchedState = INDIAN_STATES.find(s => s.toLowerCase().trim() === gstPreview.state.toLowerCase().trim());
      if (matchedState) {
        setState(matchedState);
      } else {
        setState(gstPreview.state);
      }
    }
    setGstPreview(null);
  };

  const discardGstDetails = () => {
    setGstPreview(null);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Party name is required'); return; }
    if (!state.trim()) { Alert.alert('Error', 'State is required for GST compliance'); return; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (gstin.trim() && !/^[0-9A-Z]{15}$/.test(gstin.trim().toUpperCase())) {
      Alert.alert('Error', 'Please enter a valid GST number (15 characters)');
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      if (id) {
        const editPayload = {
          name: name.trim(),
          party_type: partyType.toLowerCase(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          gstin: gstin.trim().toUpperCase() || null,
          state: state.trim() || null,
          address: address.trim() || null,
          consignment_address: consignmentAddress.trim() || null,
        };
        await api.put(`/customers/${id}?business_id=${businessId}`, editPayload);
      } else {
        const payload = {
          name: name.trim(),
          party_type: partyType.toLowerCase(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          gstin: gstin.trim().toUpperCase() || undefined,
          state: state.trim() || undefined,
          address: address.trim() || undefined,
          consignment_address: consignmentAddress.trim() || undefined,
        };
        await api.post(`/customers/?business_id=${businessId}`, payload);
      }
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save party');
    } finally {
      setSaving(false);
    }
  };

  const bottomPadding = useBottomPadding(120);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{id ? 'Edit Party' : 'New Party'}</Text>
          <Text style={styles.headerSub}>{id ? 'Update profile' : 'Draft · auto-saved'}</Text>
        </View>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: '#F8FAFC' }}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        enableOnAndroid={true}
        extraScrollHeight={150}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type Selector Tabs */}
        <View style={styles.typeRow}>
          {['customer', 'supplier', 'both'].map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.typeBtn, partyType === type && styles.typeBtnActive]}
              onPress={() => setPartyType(type as any)}
            >
              <Text style={[styles.typeBtnText, partyType === type && styles.typeBtnTextActive]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form Fields Card */}
        <View style={styles.card}>
          {/* Party Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Party Name *</Text>
            <TextInput
              key="name"
              blurOnSubmit={false}
              style={styles.input}
              placeholder="Party name"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={onChangeName}
            />
          </View>

          {/* Phone */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              key="phone"
              blurOnSubmit={false}
              style={styles.input}
              placeholder="Mobile number"
              placeholderTextColor="#94A3B8"
              value={phone}
              onChangeText={onChangePhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
          </View>

          {/* Email */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              key="email"
              blurOnSubmit={false}
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={onChangeEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* GSTIN */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>GST Number</Text>
            <TextInput
              key="gstin"
              blurOnSubmit={false}
              style={styles.input}
              placeholder="22AAAAA0000A1Z5"
              placeholderTextColor="#94A3B8"
              value={gstin}
              onChangeText={(t) => {
                const clean = t.replace(/\s/g, '');
                onChangeGstin(clean);
                if (clean.length !== 15) {
                  setGstPreview(null);
                  setGstError(null);
                }
              }}
              maxLength={15}
              autoCapitalize="characters"
            />
            {gstin.length === 15 && !gstPreview && !fetchingGst && (
              <TouchableOpacity style={styles.fetchGstBtn} onPress={fetchGstDetails}>
                <Ionicons name="search" size={14} color="#F97316" style={{ marginRight: 4 }} />
                <Text style={styles.fetchGstBtnText}>Fetch Details</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* GST Preview Card */}
        {fetchingGst && (
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
              <Text style={styles.previewLabel}>Status:</Text>
              <Text style={[styles.previewValue, gstPreview.is_active ? styles.statusActive : styles.statusInactive]}>
                {gstPreview.status || 'Unknown'}
              </Text>
            </View>

            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.useThisBtn} onPress={useGstDetails}>
                <Text style={styles.useThisText}>Use This</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.discardBtn} onPress={discardGstDetails}>
                <Text style={styles.discardText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Address Card */}
        <View style={styles.card}>
          {/* State Select Dropdown */}
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

          {/* Address Multiline */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              key="address"
              blurOnSubmit={false}
              multiline
              numberOfLines={3}
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Full address"
              placeholderTextColor="#94A3B8"
              value={address}
              onChangeText={onChangeAddress}
            />
          </View>

          {/* Shipping Address Multiline */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Shipping Address</Text>
            <TextInput
              key="consignmentAddress"
              blurOnSubmit={false}
              multiline
              numberOfLines={3}
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Shipping / Consignment address"
              placeholderTextColor="#94A3B8"
              value={consignmentAddress}
              onChangeText={onChangeConsignmentAddress}
            />
          </View>
        </View>

        {/* Add Party Submit Button */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{id ? 'Save Changes' : 'Add Party'}</Text>}
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* State Picker Modal */}
      <Modal
        visible={showStatePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStatePicker(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          style={styles.modalOverlay}
        >
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
        </KeyboardAvoidingView>
      </Modal>
    </View>
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

  content: {
    padding: 16,
    gap: 16,
  },
  typeRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  typeBtnActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  typeBtnTextActive: {
    color: '#F97316',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    gap: 14,
  },
  fieldContainer: {
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  selectInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  submitBtn: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
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
    flexShrink: 1,
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
    flexShrink: 1,
  },
  // GST Verification Styles
  fetchGstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 0.5,
    borderColor: '#FED7AA',
    borderRadius: 6,
  },
  fetchGstBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F97316',
  },
  gstStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginHorizontal: 16,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    marginTop: -8,
    marginBottom: 8,
  },
  gstStatusText: {
    fontSize: 12,
    color: '#475569',
    marginLeft: 8,
    fontWeight: '500',
  },
  gstErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    marginHorizontal: 16,
    borderWidth: 0.5,
    borderColor: '#FEE2E2',
    marginTop: -8,
    marginBottom: 8,
  },
  gstErrorText: {
    fontSize: 12,
    color: '#B91C1C',
    marginLeft: 8,
    fontWeight: '500',
  },
  gstPreviewCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: -8,
    marginBottom: 12,
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
