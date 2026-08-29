import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Modal, FlatList
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useBottomPadding, FixedBottomBar } from '../../components/ui/SafeLayout';
import { Colors, Spacing, Radius, UNITS } from '../../constants/theme';
import { GST_RATE_STRINGS } from '../../constants/gst';
import { api, setAuthToken } from '../../services/api';

export default function CreateItemScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, name: prefillName, rate: prefillRate, gstRate: prefillGstRate, hsnCode: prefillHsnCode, unit: prefillUnit } = useLocalSearchParams<{
    id?: string;
    name?: string;
    rate?: string;
    gstRate?: string;
    hsnCode?: string;
    unit?: string;
  }>();

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [name, setName] = useState(prefillName || '');
  const [hsnCode, setHsnCode] = useState(prefillHsnCode || '');
  const [rate, setRate] = useState(prefillRate || '');
  const [gstRate, setGstRate] = useState(prefillGstRate || '18');
  const [unit, setUnit] = useState((prefillUnit || 'PCS').toUpperCase());
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadBusinessAndItem = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        setAuthToken(token);
        const bizRes = await api.get('/businesses/me');
        const bId = bizRes.data.id;
        setBusinessId(bId);

        if (id) {
          const res = await api.get(`/items/${id}?business_id=${bId}`);
          const item = res.data;
          setName(item.name || '');
          setHsnCode(item.hsn_code || '');
          setRate(String(item.rate || ''));
          setGstRate(String(Math.round(item.gst_rate || 0)));
          setUnit((item.unit || 'PCS').toUpperCase());
        }
      } catch (err) {
        console.log('Error loading business/item in edit:', err);
      } finally {
        setLoading(false);
      }
    };
    loadBusinessAndItem();
  }, [id]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Item name is required');
      return;
    }
    const rateVal = Number(rate);
    if (isNaN(rateVal) || rateVal <= 0) {
      Alert.alert('Error', 'Price per unit must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const payload = {
        name: name.trim(),
        hsn_code: hsnCode.trim() || null,
        rate: rateVal,
        gst_rate: Number(gstRate),
        unit: unit.toLowerCase(),
      };

      if (id) {
        await api.put(`/items/${id}?business_id=${businessId}`, payload);
      } else {
        await api.post(`/items/?business_id=${businessId}`, payload);
      }
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item?',
      'Are you sure you want to delete this item? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              setAuthToken(token);
              await api.delete(`/items/${id}?business_id=${businessId}`);
              Alert.alert('Success', 'Item deleted successfully', [
                { text: 'OK', onPress: () => router.replace('/items') }
              ]);
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.detail || 'Failed to delete item');
            }
          }
        }
      ]
    );
  };

  const bottomPadding = useBottomPadding(20);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{id ? 'Edit Item' : 'New Item'}</Text>
          <Text style={styles.headerSub}>{id ? 'Update product details' : 'Draft · auto-saved'}</Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {id && (
            <TouchableOpacity onPress={handleDelete} style={{ padding: 4 }}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerSaveBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-sharp" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.headerSaveBtnText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 14 }}>Loading details...</Text>
        </View>
      ) : (
        <>
          <KeyboardAwareScrollView
            style={{ flex: 1, backgroundColor: '#F8FAFC' }}
            contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
            enableOnAndroid={true}
            extraScrollHeight={30}
            keyboardShouldPersistTaps="handled"
          >
            {/* Card 1: Item Details */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrap}>
                  <Ionicons name="cube-outline" size={16} color="#F97316" />
                </View>
                <Text style={styles.cardLabel}>ITEM DETAILS</Text>
              </View>

              {/* Item Name */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Item Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Paracetamol 500mg"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* HSN Code */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>HSN Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 3004"
                  placeholderTextColor="#94A3B8"
                  value={hsnCode}
                  onChangeText={setHsnCode}
                  keyboardType="numeric"
                />
              </View>

              {/* Unit Dropdown Selector */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Unit *</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => setShowUnitPicker(true)}
                >
                  <Text style={{ fontSize: 14, color: unit ? '#0F172A' : '#94A3B8' }}>
                    {unit}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Card 2: Pricing & Tax */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrap}>
                  <Ionicons name="receipt-outline" size={16} color="#F97316" />
                </View>
                <Text style={styles.cardLabel}>PRICING & TAX</Text>
              </View>

              {/* Rate (Selling Price) */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Price Per Unit (₹) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  value={rate}
                  onChangeText={setRate}
                  keyboardType="numeric"
                />
              </View>

              {/* GST chips */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>GST Rate *</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {GST_RATE_STRINGS.map(rateStr => (
                    <TouchableOpacity
                      key={rateStr}
                      onPress={() => setGstRate(rateStr)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: gstRate === rateStr ? Colors.primary : '#FFF7ED',
                        borderWidth: 1,
                        borderColor: gstRate === rateStr ? Colors.primary : '#FED7AA',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: gstRate === rateStr ? '#fff' : Colors.primary }}>
                        {rateStr}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </KeyboardAwareScrollView>

          {/* Fixed Bottom Save Button */}
          <FixedBottomBar style={styles.footerBar}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>{id ? 'Save Changes' : 'Add Item'}</Text>
              )}
            </TouchableOpacity>
          </FixedBottomBar>
        </>
      )}

      {/* Unit Picker Modal */}
      <Modal
        visible={showUnitPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUnitPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Unit</Text>
              <TouchableOpacity onPress={() => setShowUnitPicker(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <FlatList
              style={{ flex: 1 }}
              data={UNITS}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setUnit(item);
                    setShowUnitPicker(false);
                  }}
                >
                  <Text style={styles.modalItemName}>{item}</Text>
                  {unit === item && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
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
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  headerSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  headerSaveBtn: {
    backgroundColor: '#F97316',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSaveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  content: { padding: 16, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, gap: 14 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  cardIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F97316',
    letterSpacing: 0.8,
  },
  fieldContainer: { gap: 6 },
  label: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: '#E2E8F0', borderRadius: 8, padding: 11, fontSize: 14, color: '#0F172A' },
  selectInput: { backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: '#E2E8F0', borderRadius: 8, padding: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', elevation: 4, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footerBar: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, height: '50%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0' },
  modalItemName: { fontSize: 14, color: '#0F172A', fontWeight: '500' }
});
