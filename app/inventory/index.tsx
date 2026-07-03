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
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  // Modal State
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'IN' | 'OUT'>('IN');
  const [qty, setQty] = useState('1');
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

  const handleOpenAdjustment = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustmentType('IN');
    setQty('1');
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

  // Stats calculation
  const totalItemsCount = inventory.length;
  const lowStockCount = inventory.filter(i => i.current_stock > 0 && i.current_stock <= 5).length;
  const outOfStockCount = inventory.filter(i => i.current_stock === 0).length;

  const filtered = inventory.filter(item => {
    const matchesSearch = !search || item.name?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (filter === 'low') {
      return item.current_stock > 0 && item.current_stock <= 5;
    }
    if (filter === 'out') {
      return item.current_stock === 0;
    }
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.title}>Inventory</Text>
          <Text style={styles.subtitle}>{totalItemsCount} items tracked</Text>
        </View>
      </View>

      {/* Stat Strip */}
      <View style={styles.statStrip}>
        <View style={styles.statTile}>
          <Text style={styles.statVal}>{totalItemsCount}</Text>
          <Text style={styles.statLabel}>Total Items</Text>
        </View>
        <View style={[styles.statTile, styles.statTileWarning]}>
          <Text style={[styles.statVal, { color: Colors.warning }]}>{lowStockCount}</Text>
          <Text style={styles.statLabel}>Low Stock</Text>
        </View>
        <View style={[styles.statTile, styles.statTileDanger]}>
          <Text style={[styles.statVal, { color: Colors.danger }]}>{outOfStockCount}</Text>
          <Text style={styles.statLabel}>Out of Stock</Text>
        </View>
      </View>

      {/* Filter pills & Search bar */}
      <View style={styles.filterSection}>
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

        <View style={styles.pillsContainer}>
          <TouchableOpacity
            onPress={() => setFilter('all')}
            style={[styles.pill, filter === 'all' && styles.pillActive]}
          >
            <Text style={[styles.pillText, filter === 'all' && styles.pillTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('low')}
            style={[styles.pill, filter === 'low' && styles.pillActiveWarning]}
          >
            <Text style={[styles.pillText, filter === 'low' && styles.pillTextActiveWarning]}>Low stock</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('out')}
            style={[styles.pill, filter === 'out' && styles.pillActiveDanger]}
          >
            <Text style={[styles.pillText, filter === 'out' && styles.pillTextActiveDanger]}>Out of stock</Text>
          </TouchableOpacity>
        </View>
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
              {inventory.length === 0 ? "No items yet — add items first" : "No items match current filter"}
            </Text>
            {inventory.length === 0 && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/items/create')}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Add First Item</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtered.map(item => {
            const isOut = item.current_stock === 0;
            const isLow = item.current_stock > 0 && item.current_stock <= 5;
            
            let colorBar = Colors.success;
            let statusText = 'In stock';
            let statusColor = Colors.success;
            let badgeBg = '#f0fdf4';

            if (isOut) {
              colorBar = Colors.danger;
              statusText = 'Out of stock';
              statusColor = Colors.danger;
              badgeBg = '#fef2f2';
            } else if (isLow) {
              colorBar = Colors.warning;
              statusText = 'Low stock';
              statusColor = Colors.warning;
              badgeBg = '#fffbeb';
            }

            return (
              <View key={item.id} style={styles.card}>
                {/* Left colored bar */}
                <View style={[styles.cardLeftBar, { backgroundColor: colorBar }]} />

                <View style={styles.cardContent}>
                  <View style={styles.cardRow}>
                    <View style={styles.cardDetails}>
                      <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.cardSub}>Unit: {String(item.unit || 'pcs').toUpperCase()}</Text>
                      
                      {/* Status Badge */}
                      <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                      </View>
                    </View>

                    {/* Stock value */}
                    <View style={styles.stockSection}>
                      <Text style={[styles.stockValue, { color: statusColor }]}>
                        {item.current_stock}
                      </Text>
                      <Text style={styles.stockLabel}>{String(item.unit || 'pcs').toUpperCase()}</Text>
                    </View>
                  </View>

                  {/* Adjust Stock Button */}
                  <TouchableOpacity
                    style={styles.adjustBtn}
                    onPress={() => handleOpenAdjustment(item)}
                  >
                    <Ionicons name="settings-outline" size={14} color={Colors.primary} />
                    <Text style={styles.adjustBtnText}>Adjust Stock</Text>
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
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.modalTitle}>Adjust stock</Text>
                <Text style={styles.modalItemName} numberOfLines={1}>{selectedItem?.name}</Text>
                <Text style={styles.modalSubtitle}>
                  Current: {selectedItem?.current_stock} {selectedItem?.unit?.toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedItem(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
              {/* Segmented Toggle Control */}
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, adjustmentType === 'IN' && styles.toggleBtnActiveIn]}
                  onPress={() => setAdjustmentType('IN')}
                >
                  <Text style={[styles.toggleText, adjustmentType === 'IN' && styles.toggleTextActive]}>
                    Add Stock
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, adjustmentType === 'OUT' && styles.toggleBtnActiveOut]}
                  onPress={() => setAdjustmentType('OUT')}
                >
                  <Text style={[styles.toggleText, adjustmentType === 'OUT' && styles.toggleTextActive]}>
                    Remove Stock
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Quantity Stepper */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Quantity *</Text>
                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setQty(q => String(Math.max(1, Number(q || 1) - 1)))}
                  >
                    <Ionicons name="remove" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.stepperInput}
                    value={qty}
                    onChangeText={setQty}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setQty(q => String(Number(q || 0) + 1))}
                  >
                    <Ionicons name="add" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
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
                style={[
                  styles.submitBtn,
                  adjustmentType === 'IN' ? styles.submitBtnIn : styles.submitBtnOut
                ]}
                onPress={handleConfirmAdjustment}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {adjustmentType === 'IN' ? 'Add' : 'Remove'} {qty || 0} {selectedItem?.unit?.toUpperCase()}
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
  header: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  
  statStrip: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginTop: 12 },
  statTile: { flex: 1, backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 12, alignItems: 'center' },
  statTileWarning: { backgroundColor: '#fffbeb', borderColor: '#fef3c7' },
  statTileDanger: { backgroundColor: '#fef2f2', borderColor: '#fee2e2' },
  statVal: { fontSize: 18, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },

  filterSection: { backgroundColor: Colors.card, marginTop: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', marginHorizontal: 12, borderRadius: Radius.sm, paddingHorizontal: 12, height: 40, borderWidth: 0.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text, height: 20 },
  pillsContainer: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginTop: 10 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillActiveWarning: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  pillActiveDanger: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  pillText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  pillTextActiveWarning: { color: '#fff' },
  pillTextActiveDanger: { color: '#fff' },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10, marginTop: 16 },
  list: { paddingTop: 8, paddingHorizontal: 12, paddingBottom: 80, gap: 10 },
  
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, overflow: 'hidden', flexDirection: 'row' },
  cardLeftBar: { width: 5 },
  cardContent: { flex: 1, padding: 12, gap: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDetails: { flex: 1, gap: 2 },
  cardName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardSub: { fontSize: 11, color: Colors.textMuted },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  
  stockSection: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 60 },
  stockValue: { fontSize: 20, fontWeight: '800' },
  stockLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginTop: 1 },
  
  adjustBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: '#ffedd5', borderRadius: 8, paddingVertical: 8, width: '100%' },
  adjustBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0', paddingBottom: 12 },
  modalTitle: { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8 },
  modalItemName: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 4 },
  modalSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  
  toggleRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: Radius.sm, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  toggleBtnActiveIn: { backgroundColor: Colors.success, elevation: 1 },
  toggleBtnActiveOut: { backgroundColor: Colors.danger, elevation: 1 },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  toggleTextActive: { color: '#fff' },

  fieldContainer: { gap: 6 },
  label: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: '#E2E8F0', borderRadius: 8, padding: 11, fontSize: 14, color: '#0F172A' },
  
  stepperContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: '#E2E8F0', borderRadius: 8, height: 44 },
  stepperBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepperInput: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '700', height: 44 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  chipTextActive: { color: '#fff' },
  
  submitBtn: { borderRadius: 12, padding: 16, alignItems: 'center', elevation: 4, marginTop: 10 },
  submitBtnIn: { backgroundColor: Colors.success, shadowColor: Colors.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
  submitBtnOut: { backgroundColor: Colors.danger, shadowColor: Colors.danger, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' }
});
