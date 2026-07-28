import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, Image, Modal, FlatList, Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const Field = ({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, maxLength }: any) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      keyboardType={keyboardType || 'default'}
      autoCapitalize={autoCapitalize || 'words'}
      maxLength={maxLength}
    />
  </View>
);

export default function BusinessSettingsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [showStatePicker, setShowStatePicker] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  const updateField = (field: string) => (v: string) => setForm(f => ({ ...f, [field]: v }));

  // Branding states
  const [hasLogo, setHasLogo] = useState(false);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [hasSignature, setHasSignature] = useState(false);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const [form, setForm] = useState({
    name: '',
    legal_name: '',
    gstin: '',
    tagline: '',
    phone: '',
    email: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    bank_name: '',
    bank_account_number: '',
    ifsc_code: '',
    bank_branch: '',
    upi_id: ''
  });

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const res = await api.get('/businesses/me');
        const data = res.data;
        setBusiness(data);
        setBusinessId(data.id);
        setHasLogo(data.has_logo || false);
        setLogoPath(data.logo_path || null);
        setHasSignature(data.has_signature || false);
        setSignaturePath(data.signature_path || null);
        setForm({
          name: data.name || '',
          legal_name: data.legal_name || '',
          gstin: data.gst_number || '',
          tagline: data.tagline || '',
          phone: data.phone || '',
          email: data.email || '',
          address_line1: data.address_line1 || '',
          address_line2: data.address_line2 || '',
          city: data.city || '',
          state: data.state || '',
          pincode: data.pincode || '',
          bank_name: data.bank_name || '',
          bank_account_number: data.bank_account_number || '',
          ifsc_code: data.ifsc_code || '',
          bank_branch: data.bank_branch || '',
          upi_id: data.upi_id || ''
        });
      } catch (err) {
        console.warn('Failed to load business settings', err);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.put('/businesses/settings', {
        name: form.name,
        legal_name: form.legal_name,
        gst_number: form.gstin,
        tagline: form.tagline,
        phone: form.phone,
        email: form.email,
        address_line1: form.address_line1,
        address_line2: form.address_line2 ? form.address_line2 : null,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        bank_name: form.bank_name,
        bank_account_number: form.bank_account_number,
        ifsc_code: form.ifsc_code,
        bank_branch: form.bank_branch,
        upi_id: form.upi_id
      });
      Alert.alert('Success', 'Business details updated');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePickLogo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access photos is required.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const selectedAsset = result.assets[0];

      if (selectedAsset.fileSize && selectedAsset.fileSize > 2 * 1024 * 1024) {
        Alert.alert('Error', 'Image size must be under 2MB.');
        return;
      }

      const filename = selectedAsset.uri.split('/').pop() || 'logo.jpg';
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
      if (!['png', 'jpg', 'jpeg'].includes(ext)) {
        Alert.alert('Error', 'Only PNG and JPG images are allowed.');
        return;
      }

      setUploadingLogo(true);
      const token = await getToken();
      setAuthToken(token);

      const formData = new FormData();
      const type = ext === 'png' ? 'image/png' : 'image/jpeg';
      formData.append('file', {
        uri: selectedAsset.uri,
        name: filename,
        type,
      } as any);

      const res = await api.post(`/businesses/logo?business_id=${businessId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setLogoPath(res.data.url);
      setHasLogo(true);
      Alert.alert('Success', 'Logo uploaded successfully');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async () => {
    try {
      setUploadingLogo(true);
      const token = await getToken();
      setAuthToken(token);

      await api.delete(`/businesses/logo?business_id=${businessId}`);
      setLogoPath(null);
      setHasLogo(false);
      Alert.alert('Success', 'Logo removed successfully');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to remove logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handlePickSignature = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access photos is required.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const selectedAsset = result.assets[0];

      if (selectedAsset.fileSize && selectedAsset.fileSize > 2 * 1024 * 1024) {
        Alert.alert('Error', 'Image size must be under 2MB.');
        return;
      }

      const filename = selectedAsset.uri.split('/').pop() || 'sig.jpg';
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
      if (!['png', 'jpg', 'jpeg'].includes(ext)) {
        Alert.alert('Error', 'Only PNG and JPG images are allowed.');
        return;
      }

      setUploadingSignature(true);
      const token = await getToken();
      setAuthToken(token);

      const formData = new FormData();
      const type = ext === 'png' ? 'image/png' : 'image/jpeg';
      formData.append('file', {
        uri: selectedAsset.uri,
        name: filename,
        type,
      } as any);

      const res = await api.post(`/businesses/signature?business_id=${businessId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSignaturePath(res.data.url);
      setHasSignature(true);
      Alert.alert('Success', 'Signature uploaded successfully');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to upload signature');
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleDeleteSignature = async () => {
    try {
      setUploadingSignature(true);
      const token = await getToken();
      setAuthToken(token);

      await api.delete(`/businesses/signature?business_id=${businessId}`);
      setSignaturePath(null);
      setHasSignature(false);
      Alert.alert('Success', 'Signature removed successfully');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to remove signature');
    } finally {
      setUploadingSignature(false);
    }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Business Settings</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        
        {/* SECTION 1: CORE IDENTITY */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Core Identity</Text>
          <Field label="Business Name *" value={form.name} onChangeText={updateField('name')} placeholder="Your business name" />
          <Field label="Legal Name" value={form.legal_name} onChangeText={updateField('legal_name')} placeholder="Your registered legal name" />
          <Field label="GSTIN" value={form.gstin} onChangeText={updateField('gstin')} placeholder="22AAAAA0000A1Z5" autoCapitalize="characters" />
          <Field label="Tagline" value={form.tagline} onChangeText={updateField('tagline')} placeholder="Business tagline or slogan" />
        </View>

        {/* SECTION 2: CONTACT & ADDRESS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact & Address</Text>
          <Field label="Phone" value={form.phone} onChangeText={updateField('phone')} placeholder="Mobile number" keyboardType="phone-pad" autoCapitalize="none" />
          <Field label="Email" value={form.email} onChangeText={updateField('email')} placeholder="business@email.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Address Line 1" value={form.address_line1} onChangeText={updateField('address_line1')} placeholder="Building, Street, Area" />
          <Field label="Address Line 2 (optional)" value={form.address_line2} onChangeText={updateField('address_line2')} placeholder="Suite, Landmark, etc." />
          <Field label="City" value={form.city} onChangeText={updateField('city')} placeholder="City" />

          {/* State Dropdown */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.label}>State *</Text>
            <TouchableOpacity
              style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => {
                setStateSearch('');
                setShowStatePicker(true);
              }}
            >
              <Text style={{ fontSize: 14, color: form.state ? Colors.text : Colors.textMuted }}>
                {form.state || 'Select State'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Field label="Pincode" value={form.pincode} onChangeText={updateField('pincode')} placeholder="6-digit pincode" keyboardType="numeric" maxLength={6} autoCapitalize="none" />
        </View>

        {/* SECTION 3: BANK DETAILS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bank Details & UPI</Text>
          <Field label="Bank Name" value={form.bank_name} onChangeText={updateField('bank_name')} placeholder="e.g. ICICI Bank" />
          <Field label="Account Number" value={form.bank_account_number} onChangeText={updateField('bank_account_number')} placeholder="Enter account number" keyboardType="numeric" autoCapitalize="none" />
          <Field label="IFSC Code" value={form.ifsc_code} onChangeText={(v: string) => setForm(f => ({ ...f, ifsc_code: v.toUpperCase() }))} placeholder="e.g. ICIC0000104" autoCapitalize="characters" />
          <Field label="Branch" value={form.bank_branch} onChangeText={updateField('bank_branch')} placeholder="Branch location" />
          <Field label="UPI ID" value={form.upi_id} onChangeText={updateField('upi_id')} placeholder="e.g. name@upi" autoCapitalize="none" />
        </View>

        {/* SECTION 4: BRANDING */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Branding</Text>
          
          {/* LOGO */}
          <View style={styles.uploadSection}>
            <Text style={styles.label}>Business Logo</Text>
            <View style={styles.imageRow}>
              {hasLogo && logoPath ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: logoPath }} style={styles.previewImage} resizeMode="contain" />
                  <View style={styles.imageActions}>
                    <TouchableOpacity style={styles.pickerBtn} onPress={handlePickLogo} disabled={uploadingLogo}>
                      <Text style={styles.pickerBtnText}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteLogo} disabled={uploadingLogo}>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadPlaceholder} onPress={handlePickLogo} disabled={uploadingLogo}>
                  {uploadingLogo ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
                      <Text style={styles.placeholderText}>Upload Logo (PNG/JPG, Max 2MB)</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* SIGNATURE */}
          <View style={[styles.uploadSection, { marginTop: 20 }]}>
            <Text style={styles.label}>Digital Signature / Stamp</Text>
            <View style={styles.imageRow}>
              {hasSignature && signaturePath ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: signaturePath }} style={styles.previewImage} resizeMode="contain" />
                  <View style={styles.imageActions}>
                    <TouchableOpacity style={styles.pickerBtn} onPress={handlePickSignature} disabled={uploadingSignature}>
                      <Text style={styles.pickerBtnText}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteSignature} disabled={uploadingSignature}>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadPlaceholder} onPress={handlePickSignature} disabled={uploadingSignature}>
                  {uploadingSignature ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
                      <Text style={styles.placeholderText}>Upload Signature (PNG/JPG, Max 2MB)</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.signatureLinkBtn}
              onPress={() => Linking.openURL('https://udyogbook.in/tools/digital-signature')}
            >
              <Ionicons name="open-outline" size={15} color={Colors.primary} />
              <Text style={styles.signatureLinkText}>Create a digital signature online</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>

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
                    setForm(f => ({ ...f, state: item }));
                    setShowStatePicker(false);
                  }}
                >
                  <Text style={styles.modalItemName}>{item}</Text>
                  {form.state === item && <Ionicons name="checkmark" size={18} color="#F97316" />}
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingBottom: 6 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 11, fontSize: 14, color: Colors.text },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, padding: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  uploadSection: { marginVertical: 4 },
  imageRow: { marginTop: 8 },
  imageContainer: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  previewImage: { width: 90, height: 90, borderRadius: Radius.sm, backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: Colors.border },
  imageActions: { flex: 1, flexDirection: 'row', gap: 10 },
  pickerBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  pickerBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  deleteBtn: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  deleteBtnText: { color: '#b91c1c', fontWeight: '600', fontSize: 13 },
  uploadPlaceholder: { height: 90, borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: Radius.sm, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', gap: 6 },
  placeholderText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  signatureLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 4 },
  signatureLinkText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 },
  modalSearchInput: { flex: 1, fontSize: 14, color: '#0F172A', padding: 0 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0' },
  modalItemName: { fontSize: 15, color: '#0F172A', fontWeight: '500' },
});
