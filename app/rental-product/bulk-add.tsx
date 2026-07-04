import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

const GST_RATES = ['0', '5', '18', '40'];
const RATE_TYPES = [
  { label: 'Day', value: 'DAILY' },
  { label: 'Week', value: 'WEEKLY' },
  { label: 'Month', value: 'MONTHLY' }
];

interface BulkRow {
  name: string;
  rate: string;
  rateType: string;
  gstRate: string;
  hsnCode: string;
}

const createEmptyRow = (): BulkRow => ({
  name: '',
  rate: '',
  rateType: 'DAILY',
  gstRate: '18',
  hsnCode: ''
});

export default function BulkAddProductScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkRow[]>([
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow()
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadBusiness = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const bizRes = await api.get('/businesses/me');
        setBusinessId(bizRes.data.id);
      } catch (err) {
        console.log('Error fetching business:', err);
      }
    };
    loadBusiness();
  }, [getToken]);

  const updateRowField = (index: number, field: keyof BulkRow, value: string) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) {
      Alert.alert('Cannot Remove', 'Keep at least one product row.');
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    if (!businessId) return;

    // Filter out completely empty rows
    const validRows = rows.filter(
      (r) =>
        r.name.trim() || r.rate.trim() || r.hsnCode.trim()
    );

    if (validRows.length === 0) {
      Alert.alert('Empty Form', 'Please enter at least one product.');
      return;
    }

    // Validate rows
    const errors: string[] = [];
    const payloads: any[] = [];

    validRows.forEach((r, idx) => {
      const nameVal = r.name.trim();
      const rateVal = parseFloat(r.rate);

      if (!nameVal) {
        errors.push(`Row ${idx + 1}: Name is required`);
        return;
      }
      if (isNaN(rateVal) || rateVal <= 0) {
        errors.push(`Row ${idx + 1} (${nameVal || 'unnamed'}): Rate must be greater than 0`);
        return;
      }

      payloads.push({
        name: nameVal,
        description: null,
        rate: rateVal,
        rate_type: r.rateType,
        gst_rate: parseFloat(r.gstRate),
        hsn_code: r.hsnCode.trim() || null
      });
    });

    if (errors.length > 0) {
      Alert.alert('Validation Error', errors.join('\n'));
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const results = await Promise.allSettled(
        payloads.map((payload) =>
          api.post(`/rental-products/?business_id=${businessId}`, payload)
        )
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed === 0) {
        Alert.alert('Success', `All ${succeeded} products saved successfully.`, [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert(
          'Bulk Addition Complete',
          `${succeeded} products added successfully. ${failed} failed to save.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (err) {
      console.log('Bulk save error:', err);
      Alert.alert('Error', 'An error occurred while saving products.');
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
        <Text style={styles.headerTitle}>Bulk Add Products</Text>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSaveAll}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 60 }}
        enableOnAndroid={true}
        extraScrollHeight={40}
        keyboardShouldPersistTaps="handled"
      >
        {rows.map((row, index) => (
          <View key={index} style={styles.rowCard}>
            {/* Card Header */}
            <View style={styles.rowHeader}>
              <Text style={styles.rowNumber}>Product #{index + 1}</Text>
              <TouchableOpacity onPress={() => removeRow(index)} style={styles.trashBtn}>
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              </TouchableOpacity>
            </View>

            {/* Product Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Product Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Scaffolding set"
                value={row.name}
                onChangeText={(val) => updateRowField(index, 'name', val)}
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Rate & Rate Type */}
            <View style={styles.flexRow}>
              <View style={[styles.fieldContainer, { flex: 1 }]}>
                <Text style={styles.label}>Rate (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={row.rate}
                  onChangeText={(val) => updateRowField(index, 'rate', val)}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={[styles.fieldContainer, { flex: 1.2 }]}>
                <Text style={styles.label}>Rate Per</Text>
                <View style={styles.pickerContainer}>
                  {RATE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.pickerButton,
                        row.rateType === type.value ? styles.pickerActive : null
                      ]}
                      onPress={() => updateRowField(index, 'rateType', type.value)}
                    >
                      <Text style={[
                        styles.pickerText,
                        row.rateType === type.value ? styles.pickerTextActive : null
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* GST Rate & HSN Code */}
            <View style={styles.flexRow}>
              <View style={[styles.fieldContainer, { flex: 1 }]}>
                <Text style={styles.label}>GST Rate</Text>
                <View style={styles.gstContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}
                  >
                    {GST_RATES.map((rateStr) => (
                      <TouchableOpacity
                        key={rateStr}
                        style={[
                          styles.gstBtn,
                          row.gstRate === rateStr ? styles.gstActive : null
                        ]}
                        onPress={() => updateRowField(index, 'gstRate', rateStr)}
                      >
                        <Text style={[
                          styles.gstText,
                          row.gstRate === rateStr ? styles.gstTextActive : null
                        ]}>
                          {rateStr}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={[styles.fieldContainer, { flex: 1 }]}>
                <Text style={styles.label}>HSN Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 9973"
                  value={row.hsnCode}
                  onChangeText={(val) => updateRowField(index, 'hsnCode', val)}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>
          </View>
        ))}

        {/* Add Row Button */}
        <TouchableOpacity style={styles.addRowBtn} onPress={addRow}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.addRowText}>Add Another Row</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: Colors.card, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.text, marginLeft: 12 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#FED7AA' },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  rowCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, marginBottom: 14, borderWidth: 0.5, borderColor: Colors.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingBottom: 8 },
  rowNumber: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  trashBtn: { padding: 4 },

  fieldContainer: { marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: Colors.text, backgroundColor: '#FAFBFD', height: 36 },

  flexRow: { flexDirection: 'row', gap: 10 },

  pickerContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 6, padding: 2, height: 36, alignItems: 'center' },
  pickerButton: { flex: 1, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  pickerActive: { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5 },
  pickerText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  pickerTextActive: { color: Colors.text, fontWeight: '600' },

  gstContainer: { borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 6, backgroundColor: '#FAFBFD', height: 36, justifyContent: 'center' },
  gstBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#FFF7ED', borderWidth: 0.5, borderColor: '#FED7AA' },
  gstActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  gstText: { fontSize: 10, fontWeight: '600', color: Colors.primary },
  gstTextActive: { color: '#fff' },

  addRowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.primary, borderRadius: 10, paddingVertical: 12, marginTop: 4, backgroundColor: '#FFF7ED' },
  addRowText: { fontSize: 13, fontWeight: '700', color: Colors.primary }
});
