import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Modal, FlatList, StatusBar, KeyboardAvoidingView, Platform
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

export default function BusinessAddScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { switchBusiness } = useBusiness();

  const [name, setName] = useState('');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstNumber, setGstNumber] = useState('');
  const [state, setState] = useState('');
  const [saving, setSaving] = useState(false);

  const [showStatePicker, setShowStatePicker] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  const onChangeName = useCallback((text: string) => setName(text), []);
  const onChangeGstNumber = useCallback((text: string) => setGstNumber(text), []);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Business name is required'); return; }
    if (name.trim().length < 3) { Alert.alert('Error', 'Business name must be at least 3 characters'); return; }
    if (gstEnabled && !gstNumber.trim()) { Alert.alert('Error', 'GSTIN is required when GST is enabled'); return; }
    if (gstEnabled && gstNumber.trim().length !== 15) { Alert.alert('Error', 'GSTIN must be exactly 15 characters'); return; }
    if (!state.trim()) { Alert.alert('Error', 'State is required'); return; }

    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const payload = {
        name: name.trim(),
        gst_enabled: gstEnabled,
        gst_number: gstEnabled ? gstNumber.trim().toUpperCase() : null,
        state: state.trim(),
        business_type: 'individual'
      };

      const res = await api.post('/businesses/', payload);
      
      // Switch active business in context
      await switchBusiness(res.data.id);
      
      // Navigate to tabs
      router.replace('/(tabs)');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        const fieldNames: Record<string, string> = {
          gst_number: 'GST Number',
          name: 'Business Name',
          state: 'State',
        };
        const messages = detail.map((e: any) => {
          const field = e.loc?.[e.loc.length - 1];
          const label = fieldNames[field] || field;
          return `${label}: ${e.msg}`;
        });
        Alert.alert('Please Check Your Details', messages.join('\n'));
      } else if (typeof detail === 'string') {
        Alert.alert('Add Business Failed', detail);
      } else {
        Alert.alert('Add Business Failed', err.message || 'Something went wrong. Please try again.');
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.logoText}>Add New Business</Text>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: 48 + insets.bottom }]}
        enableOnAndroid={true}
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.title}>Create Business</Text>
          <Text style={styles.subtitle}>Expand operations with another entity.</Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          {/* Business Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Business Name *</Text>
            <TextInput
              blurOnSubmit={false}
              style={styles.input}
              placeholder="e.g. Ravi Enterprises"
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
                onChangeText={onChangeGstNumber}
                maxLength={15}
                autoCapitalize="characters"
              />
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
        </View>

        {/* Complete Action Button */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Create Business →</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A'
  },
  content: {
    padding: 24,
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
});
