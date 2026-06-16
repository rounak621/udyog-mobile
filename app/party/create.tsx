import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Platform, Modal, FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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
  
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('');
  const [address, setAddress] = useState('');
  const [partyType, setPartyType] = useState<'customer' | 'supplier' | 'both'>('customer');
  const [saving, setSaving] = useState(false);

  const [showStatePicker, setShowStatePicker] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  // Stable callbacks for input fields to avoid focus loss
  const onChangeName = useCallback((text: string) => setName(text), []);
  const onChangePhone = useCallback((text: string) => setPhone(text), []);
  const onChangeEmail = useCallback((text: string) => setEmail(text), []);
  const onChangeGstin = useCallback((text: string) => setGstin(text), []);
  const onChangeAddress = useCallback((text: string) => setAddress(text), []);

  useEffect(() => {
    const loadBusiness = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const bizRes = await api.get('/businesses/me');
        setBusinessId(bizRes.data.id);
      } catch (err) {
        console.log('Error loading business in party create:', err);
      }
    };
    loadBusiness();
  }, []);

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

      const payload = {
        name: name.trim(),
        party_type: partyType.toUpperCase(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gstin: gstin.trim().toUpperCase() || undefined,
        state: state.trim() || undefined,
        address: address.trim() || undefined,
      };

      await api.post(`/customers/?business_id=${businessId}`, payload);
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create party');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>New Party</Text>
          <Text style={styles.headerSub}>Draft · auto-saved</Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#F97316" size="small" />
          ) : (
            <>
              <Ionicons name="save-outline" size={16} color="#F97316" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: '#F8FAFC' }}
        contentContainerStyle={styles.content}
        enableOnAndroid={true}
        extraScrollHeight={20}
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
              onChangeText={onChangeGstin}
              maxLength={15}
              autoCapitalize="characters"
            />
          </View>

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
              <Text style={{ fontSize: 14, color: state ? '#0F172A' : '#94A3B8' }}>
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
        </View>

        {/* Add Party Submit Button */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Add Party</Text>}
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
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
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
});
