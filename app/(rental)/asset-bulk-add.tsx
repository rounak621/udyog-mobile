import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, FlatList
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

interface RentalProduct {
  id: string;
  name: string;
}

export default function AssetBulkAddScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ productId?: string; productName?: string }>();

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [products, setProducts] = useState<RentalProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<RentalProduct | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);

  // Modes: 'PASTE' or 'GENERATE'
  const [mode, setMode] = useState<'PASTE' | 'GENERATE'>('PASTE');

  // Paste list mode state
  const [pastedCodes, setPastedCodes] = useState('');

  // Auto generate mode state
  const [prefix, setPrefix] = useState('');
  const [startNum, setStartNum] = useState('1');
  const [count, setCount] = useState('5');
  const [padding, setPadding] = useState('3');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        setAuthToken(token);
        
        const bizRes = await api.get('/businesses/me');
        const bId = bizRes.data.id;
        setBusinessId(bId);

        const prodRes = await api.get(`/rental-products/?business_id=${bId}`);
        const productList = prodRes.data;
        setProducts(productList);

        // Pre-select if passed in params
        if (params.productId && params.productName) {
          setSelectedProduct({ id: params.productId, name: params.productName });
        } else if (productList.length > 0) {
          setSelectedProduct(productList[0]);
        }
      } catch (err) {
        console.log('Error loading products for picker:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [params.productId, params.productName, getToken]);

  const handleAddAssets = async () => {
    if (!businessId) return;
    if (!selectedProduct) {
      Alert.alert('Required Field', 'Please select a product first.');
      return;
    }

    let codes: string[] = [];

    if (mode === 'PASTE') {
      codes = pastedCodes
        .split('\n')
        .map((c) => c.trim())
        .filter((c) => c !== '');

      if (codes.length === 0) {
        Alert.alert('Required Field', 'Please paste at least one asset code.');
        return;
      }
    } else {
      if (!prefix.trim()) {
        Alert.alert('Required Field', 'Please enter a prefix.');
        return;
      }
      const start = parseInt(startNum);
      const totalCount = parseInt(count);
      const padLen = parseInt(padding);

      if (isNaN(start) || start < 0) {
        Alert.alert('Invalid Input', 'Starting number must be 0 or greater.');
        return;
      }
      if (isNaN(totalCount) || totalCount <= 0 || totalCount > 100) {
        Alert.alert('Invalid Input', 'Count must be between 1 and 100.');
        return;
      }
      if (isNaN(padLen) || padLen < 0 || padLen > 10) {
        Alert.alert('Invalid Input', 'Padding must be between 0 and 10.');
        return;
      }

      for (let i = 0; i < totalCount; i++) {
        const numStr = (start + i).toString().padStart(padLen, '0');
        codes.push(`${prefix.trim()}${numStr}`);
      }
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const results = await Promise.allSettled(
        codes.map((code) =>
          api.post(`/rental-assets/?business_id=${businessId}`, {
            rental_product_id: selectedProduct.id,
            asset_code: code,
            condition: 'EXCELLENT'
          })
        )
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed === 0) {
        Alert.alert('Success', `All ${succeeded} assets added successfully.`, [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert(
          'Bulk Addition Complete',
          `${succeeded} assets added successfully. ${failed} failed to save.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (err) {
      console.log('Bulk asset save error:', err);
      Alert.alert('Error', 'An error occurred while saving assets.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Assets</Text>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleAddAssets}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 12, color: Colors.textMuted }}>Loading products...</Text>
        </View>
      ) : (
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          enableOnAndroid={true}
          extraScrollHeight={20}
          keyboardShouldPersistTaps="handled"
        >
          {/* Product Picker */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Rental Product *</Text>
            <TouchableOpacity
              style={styles.pickerSelector}
              onPress={() => setShowProductModal(true)}
            >
              <Text style={styles.pickerValueText}>
                {selectedProduct ? selectedProduct.name : 'Select Product'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Mode Switcher segments */}
          <View style={styles.segmentedContainer}>
            <TouchableOpacity
              style={[styles.segmentButton, mode === 'PASTE' ? styles.segmentActive : null]}
              onPress={() => setMode('PASTE')}
            >
              <Text style={[styles.segmentText, mode === 'PASTE' ? styles.segmentTextActive : null]}>
                Paste List
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentButton, mode === 'GENERATE' ? styles.segmentActive : null]}
              onPress={() => setMode('GENERATE')}
            >
              <Text style={[styles.segmentText, mode === 'GENERATE' ? styles.segmentTextActive : null]}>
                Auto Generate
              </Text>
            </TouchableOpacity>
          </View>

          {/* Inputs based on Mode */}
          {mode === 'PASTE' ? (
            <View style={styles.card}>
              <Text style={styles.cardInfoTitle}>Paste Asset Codes</Text>
              <Text style={styles.cardInfoSub}>Enter one unique asset code per line.</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="e.g.&#10;MIX-001&#10;MIX-002&#10;MIX-003"
                value={pastedCodes}
                onChangeText={setPastedCodes}
                multiline
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
              />
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardInfoTitle}>Generate Asset Codes</Text>
              <Text style={styles.cardInfoSub}>Configure sequence rules to auto-generate codes.</Text>

              {/* Prefix */}
              <View style={styles.innerField}>
                <Text style={styles.label}>Prefix *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. MIX-"
                  value={prefix}
                  onChangeText={setPrefix}
                  autoCapitalize="characters"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.flexRow}>
                {/* Start Number */}
                <View style={[styles.innerField, { flex: 1 }]}>
                  <Text style={styles.label}>Start Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    value={startNum}
                    onChangeText={setStartNum}
                    keyboardType="numeric"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* Count */}
                <View style={[styles.innerField, { flex: 1 }]}>
                  <Text style={styles.label}>Quantity/Count *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="5"
                    value={count}
                    onChangeText={setCount}
                    keyboardType="numeric"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* Padding */}
                <View style={[styles.innerField, { flex: 1 }]}>
                  <Text style={styles.label}>Padding *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="3"
                    value={padding}
                    onChangeText={setPadding}
                    keyboardType="numeric"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              {/* Preview Box */}
              {prefix.trim() && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>PREVIEW GENERATED CODES:</Text>
                  <Text style={styles.previewText} numberOfLines={1}>
                    {prefix.trim()}{startNum.padStart(parseInt(padding) || 0, '0')} ➔{' '}
                    {prefix.trim()}
                    {(parseInt(startNum) + Math.max(0, (parseInt(count) || 1) - 1))
                      .toString()
                      .padStart(parseInt(padding) || 0, '0')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </KeyboardAwareScrollView>
      )}

      {/* Product Selection Modal */}
      <Modal visible={showProductModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Rental Product</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedProduct?.id === item.id ? styles.modalItemActive : null
                  ]}
                  onPress={() => {
                    setSelectedProduct(item);
                    setShowProductModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    selectedProduct?.id === item.id ? styles.modalItemTextActive : null
                  ]}>
                    {item.name}
                  </Text>
                  {selectedProduct?.id === item.id && (
                    <Ionicons name="checkmark" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  header: { backgroundColor: Colors.card, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.text, marginLeft: 12 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#FED7AA' },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  fieldContainer: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  pickerSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.card },
  pickerValueText: { fontSize: 14, color: Colors.text, fontWeight: '500' },

  segmentedContainer: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 8, padding: 3, marginBottom: 16 },
  segmentButton: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 6, height: 34 },
  segmentActive: { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  segmentText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  segmentTextActive: { color: Colors.text, fontWeight: '600' },

  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  cardInfoTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardInfoSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2, marginBottom: 14 },

  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: Colors.text, backgroundColor: '#FAFBFD' },
  multilineInput: { height: 160, textAlignVertical: 'top' },

  innerField: { marginBottom: 12 },
  flexRow: { flexDirection: 'row', gap: 10 },

  previewBox: { marginTop: 16, padding: 12, backgroundColor: '#FFF7ED', borderRadius: 8, borderWidth: 1, borderColor: '#FED7AA' },
  previewLabel: { fontSize: 9, fontWeight: '700', color: Colors.primary, letterSpacing: 0.5 },
  previewText: { fontSize: 12, color: Colors.text, fontWeight: '600', marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
  modalItemText: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  modalItemTextActive: { color: Colors.primary, fontWeight: '600' },
  modalItemActive: { backgroundColor: '#FFF7ED', borderRadius: 8, paddingHorizontal: 8 },
});
