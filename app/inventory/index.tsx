import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, RefreshControl,
  ActivityIndicator, Modal, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  price: number;
  is_active: boolean;
  current_stock: number;
}

const REASONS = ['PURCHASE', 'RETURN', 'OPENING_STOCK', 'MANUAL', 'DAMAGED', 'THEFT'];

export default function InventoryScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Modal State
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'IN' | 'OUT'>('IN');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('MANUAL');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadInventory = useCallback(async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      const res = await api.get(`/inventory/?business_id=${bId}`);
      setInventory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log('Inventory loading error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      loadInventory();
    }, [loadInventory])
  );

  const handleOpenAdjustment = (item: InventoryItem, type: 'IN' | 'OUT') => {
    setSelectedItem(item);
    setAdjustmentType(type);
    setQty('');
    setReason('MANUAL');
    setNotes('');
  };

  const handleConfirmAdjustment = async () => {
    const qtyVal = Number(qty);
    if (isNaN(qtyVal) || qtyVal <= 0 || !Number.isInteger(qtyVal)) {
      Alert.alert('Error', 'Please enter a valid positive integer quantity');
      return;
    }
    if (!selectedItem) return;

    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;

      await api.post(`/inventory/adjust?business_id=${bId}`, {
        item_id: selectedItem.id,
        adjustment_type: adjustmentType,
        quantity: qtyVal,
        reason: reason,
        notes: notes.trim() || null
      });

      setSelectedItem(null);
      loadInventory();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to submit stock adjustment');
    } finally {
      setSaving(false);
    }
  };

  const filtered = inventory.filter(item => {
    return !search || item.name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Topbar */}
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Inventory</Text>
      </View>

      {/* Search Box */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search inventory items..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={[styles.list, (loading || filtered.length === 0) && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadInventory();
            }}
            colors={[Colors.primary]}
          />
        }
      >
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 14 }}>Loading inventory...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="layers-outline" size={48} color="#cbd5e1" />
            <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '500', marginTop: 12 }}>
              No items yet — add items first
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/items/create')}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Add First Item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map(item => {
            const isLowStock = item.current_stock <= 5;
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.cardSub}>Unit: {String(item.unit || 'pcs').toUpperCase()}</Text>
                </View>

                {/* Stock Level Display */}
                <View style={styles.stockSection}>
                  <Text style={[styles.stockValue, isLowStock && styles.lowStock]}>
                    {item.current_stock}
                  </Text>
                  <Text style={styles.stockLabel}>Available</Text>
                </View>

                {/* Adjustment Buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnIn]}
                    onPress={() => handleOpenAdjustment(item, 'IN')}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnOut]}
                    onPress={() => handleOpenAdjustment(item, 'OUT')}
                  >
                    <Ionicons name="remove" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Adjustment Bottom Sheet Modal */}
      <Modal
        visible={selectedItem !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedItem(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Stock {adjustmentType === 'IN' ? 'In' : 'Out'} — {selectedItem?.name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedItem(null)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
              {/* Quantity */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Quantity *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 10"
                  placeholderTextColor="#94A3B8"
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="numeric"
                />
              </View>

              {/* Reason Selector Chips */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Reason *</Text>
                <View style={styles.chipRow}>
                  {REASONS.map(r => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setReason(r)}
                      style={[
                        styles.chip,
                        reason === r && styles.chipActive,
                      ]}
                    >
                      <Text style={[styles.chipText, reason === r && styles.chipTextActive]}>
                        {r.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Notes */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="e.g. Opening balance or damage"
                  placeholderTextColor="#94A3B8"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Action Button */}
              <TouchableOpacity
                style={[styles.submitBtn, adjustmentType === 'OUT' && styles.submitBtnOut]}
                onPress={handleConfirmAdjustment}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    Confirm Stock {adjustmentType === 'IN' ? 'In' : 'Out'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, marginHorizontal: 12, marginTop: 12, marginBottom: 8, borderRadius: Radius.sm, paddingHorizontal: 12, height: 44, borderWidth: 0.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text, height: 20 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10, marginTop: 16 },
  list: { paddingTop: 4, paddingHorizontal: 12, paddingBottom: 80, gap: 8 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  cardSub: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  stockSection: { alignItems: 'center', justifyContent: 'center', minWidth: 60, paddingHorizontal: 4 },
  stockValue: { fontSize: 18, fontWeight: '700', color: Colors.success },
  lowStock: { color: Colors.danger },
  stockLabel: { fontSize: 9, color: Colors.textMuted, marginTop: 2, textTransform: 'uppercase', fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 6 },
  btn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', elevation: 1 },
  btnIn: { backgroundColor: Colors.success },
  btnOut: { backgroundColor: Colors.danger },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', flex: 1 },
  fieldContainer: { gap: 6 },
  label: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: '#E2E8F0', borderRadius: 8, padding: 11, fontSize: 14, color: '#0F172A' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  chipTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: Colors.success, borderRadius: 12, padding: 16, alignItems: 'center', elevation: 4, marginTop: 10 },
  submitBtnOut: { backgroundColor: Colors.danger },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' }
});
