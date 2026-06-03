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

export default function BusinessSettingsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', gstin: '', phone: '', email: '', address: '', state: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const res = await api.get('/businesses/me');
        setBusiness(res.data);
        setForm({
          name: res.data.name || '',
          gstin: res.data.gst_number || '',
          phone: res.data.phone || '',
          email: res.data.email || '',
          address: res.data.address || '',
          state: res.data.state || '',
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
        name: form.name,
        gst_number: form.gstin,
        phone: form.phone,
        email: form.email,
        address: form.address,
        state: form.state,
      });
      Alert.alert('Success', 'Business details updated');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, field, placeholder, keyboardType, autoCapitalize }: any) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={form[field as keyof typeof form]}
        onChangeText={v => setForm(f => ({ ...f, [field]: v }))}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType || 'default'}
        autoCapitalize={autoCapitalize || 'words'}
      />
    </View>
  );

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
        <View style={styles.card}>
          <Field label="Business Name *" field="name" placeholder="Your business name" />
          <Field label="GSTIN" field="gstin" placeholder="22AAAAA0000A1Z5" autoCapitalize="characters" />
          <Field label="Phone" field="phone" placeholder="Mobile number" keyboardType="phone-pad" autoCapitalize="none" />
          <Field label="Email" field="email" placeholder="business@email.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="State" field="state" placeholder="Maharashtra" />
          <Field label="Address" field="address" placeholder="Full business address" />
        </View>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
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
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 11, fontSize: 14, color: Colors.text },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, padding: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
