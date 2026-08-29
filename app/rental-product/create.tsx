import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useBottomPadding } from '../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { GST_RATE_STRINGS } from '../../constants/gst';
import { api, setAuthToken } from '../../services/api';
const RATE_TYPES = [
  { label: 'Daily', value: 'DAILY' },
  { label: 'Weekly', value: 'WEEKLY' },
  { label: 'Monthly', value: 'MONTHLY' }
];

export default function CreateProductScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rate, setRate] = useState('');
  const [rateType, setRateType] = useState('DAILY');
  const [gstRate, setGstRate] = useState('18');
  const [hsnCode, setHsnCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadBusinessAndProduct = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        setAuthToken(token);
        const bizRes = await api.get('/businesses/me');
        const bId = bizRes.data.id;
        setBusinessId(bId);

        if (id) {
          const res = await api.get(`/rental-products/${id}?business_id=${bId}`);
          const prod = res.data;
          setName(prod.name || '');
          setDescription(prod.description || '');
          setRate(String(prod.rate || ''));
          setRateType(prod.rate_type || 'DAILY');
          setGstRate(String(Math.round(prod.gst_rate || 18)));
          setHsnCode(prod.hsn_code || '');
        }
      } catch (err: any) {
        console.log('Error loading product details:', err);
        Alert.alert('Error', 'Failed to load product details.');
      } finally {
        setLoading(false);
      }
    };
    loadBusinessAndProduct();
  }, [id, getToken]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter a product name.');
      return;
    }
    const parsedRate = parseFloat(rate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid rate greater than 0.');
      return;
    }
    if (!businessId) return;

    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        rate: parsedRate,
        rate_type: rateType,
        gst_rate: parseFloat(gstRate),
        hsn_code: hsnCode.trim() || null
      };

      if (id) {
        await api.put(`/rental-products/${id}?business_id=${businessId}`, payload);
      } else {
        await api.post(`/rental-products/?business_id=${businessId}`, payload);
      }

      router.back();
    } catch (err: any) {
      console.log('Error saving product:', err);
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id || !businessId) return;

    Alert.alert(
      'Delete Product?',
      'Are you sure you want to delete this product? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              setAuthToken(token);
              await api.delete(`/rental-products/${id}?business_id=${businessId}`);
              router.back();
            } catch (err: any) {
              console.log('Error deleting product:', err);
              Alert.alert('Error', err.response?.data?.detail || 'Failed to delete product.');
            }
          }
        }
      ]
    );
  };

  const bottomPadding = useBottomPadding(40);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{id ? 'Edit Product' : 'New Product'}</Text>
        </View>

        {id && (
          <TouchableOpacity onPress={handleDelete} style={{ padding: 4, marginRight: 12 }}>
            <Ionicons name="trash-outline" size={22} color={Colors.danger} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <>
              <Ionicons name="save-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 14 }}>Loading details...</Text>
        </View>
      ) : (
        <KeyboardAwareScrollView
          style={{ flex: 1, backgroundColor: '#F8FAFC' }}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
          enableOnAndroid={true}
          extraScrollHeight={20}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            {/* Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Product Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Concrete Mixer"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Description */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Details or usage instructions..."
                placeholderTextColor="#94A3B8"
                value={description}
                onChangeText={setDescription}
                multiline={true}
                numberOfLines={3}
              />
            </View>

            {/* Rate */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Rental Rate (₹) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                value={rate}
                onChangeText={setRate}
                keyboardType="numeric"
              />
            </View>

            {/* Rate Type (Segmented control) */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Rate Per</Text>
              <View style={styles.segmentedContainer}>
                {RATE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.segmentButton,
                      rateType === type.value ? styles.segmentActive : null
                    ]}
                    onPress={() => setRateType(type.value)}
                  >
                    <Text style={[
                      styles.segmentText,
                      rateType === type.value ? styles.segmentTextActive : null
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* GST chips */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>GST Rate *</Text>
              <View style={styles.chipsContainer}>
                {GST_RATE_STRINGS.map((rateStr) => (
                  <TouchableOpacity
                    key={rateStr}
                    onPress={() => setGstRate(rateStr)}
                    style={[
                      styles.chip,
                      gstRate === rateStr ? styles.chipActive : null
                    ]}
                  >
                    <Text style={[
                      styles.chipText,
                      gstRate === rateStr ? styles.chipTextActive : null
                    ]}>
                      {rateStr}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* HSN Code */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>HSN/SAC Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 9973"
                placeholderTextColor="#94A3B8"
                value={hsnCode}
                onChangeText={setHsnCode}
                keyboardType="numeric"
              />
            </View>
          </View>
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  header: { backgroundColor: Colors.card, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  saveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#FED7AA' },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  content: { padding: 16 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  fieldContainer: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: Colors.text, backgroundColor: '#FAFBFD' },
  multilineInput: { height: 70, textAlignVertical: 'top' },

  segmentedContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 3 },
  segmentButton: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 6, height: 32 },
  segmentActive: { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  segmentText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  segmentTextActive: { color: Colors.text, fontWeight: '600' },

  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  chipTextActive: { color: '#fff' },
});
