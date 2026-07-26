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
import { Colors, Spacing, Radius, UNITS } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

interface Item {
  id: number;
  name: string;
  hsn_code: string | null;
  rate: number;
  gst_rate: number;
  unit: string;
  is_active: boolean;
}

interface BulkRow {
  id: string;
  name: string;
  rate: string;
}

const createEmptyRow = (): BulkRow => ({
  id: Math.random().toString(),
  name: '',
  rate: '',
});

const GST_RATES = ['0', '5', '12', '18', '28'];

export default function ItemsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Bulk Add Modal state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkHsn, setBulkHsn] = useState('');
  const [bulkGstRate, setBulkGstRate] = useState('18');
  const [bulkUnit, setBulkUnit] = useState('PCS');
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ]);
  const [savingBulk, setSavingBulk] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      setBusinessId(bId);
      const res = await api.get(`/items/?business_id=${bId}&include_inactive=false`);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log('Items loading error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const handleAddRow = () => {
    setBulkRows(prev => [...prev, createEmptyRow()]);
  };

  const handleRemoveRow = (id: string) => {
    if (bulkRows.length <= 1) return;
    setBulkRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: 'name' | 'rate', val: string) => {
    setBulkRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const handleSaveBulk = async () => {
    const validRows = bulkRows.filter(r => r.name.trim() && r.rate.trim() && !isNaN(Number(r.rate)));
    if (validRows.length === 0) {
      Alert.alert('Validation Error', 'Please enter at least one item with a valid name and rate.');
      return;
    }

    setSavingBulk(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const token = await getToken();
      setAuthToken(token);

      for (const row of validRows) {
        try {
          await api.post(`/items/?business_id=${businessId}`, {
            name: row.name.trim(),
            hsn_code: bulkHsn.trim() || null,
            rate: Number(row.rate),
            gst_rate: Number(bulkGstRate),
            unit: bulkUnit,
          });
          successCount++;
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        Alert.alert(
          'Bulk Add Complete',
          `${successCount} item${successCount > 1 ? 's' : ''} saved successfully.${failCount > 0 ? ` (${failCount} failed)` : ''}`
        );
        setShowBulkModal(false);
        setBulkHsn('');
        setBulkGstRate('18');
        setBulkUnit('PCS');
        setBulkRows([createEmptyRow(), createEmptyRow(), createEmptyRow(), createEmptyRow(), createEmptyRow()]);
        loadItems();
      } else {
        Alert.alert('Error', 'Failed to save items. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Bulk add failed');
    } finally {
      setSavingBulk(false);
    }
  };

  const filtered = items.filter(item => {
    return !search || item.name?.toLowerCase().includes(search.toLowerCase()) || item.hsn_code?.toLowerCase().includes(search.toLowerCase());
  });

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Items</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.bulkBtn} onPress={() => setShowBulkModal(true)}>
            <Ionicons name="layers-outline" size={16} color={Colors.primary} />
            <Text style={styles.bulkBtnText}>Bulk Add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/items/create')}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items by name or HSN..."
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

      <ScrollView
        contentContainerStyle={[styles.list, (loading || filtered.length === 0) && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadItems();
            }}
            colors={[Colors.primary]}
          />
        }
      >
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 14 }}>Loading...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color="#cbd5e1" />
            <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '500', marginTop: 12 }}>No items yet</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/items/create')}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Add Single Item</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.primary }]}
                onPress={() => setShowBulkModal(true)}
              >
                <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '600' }}>Bulk Add Items</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          filtered.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => router.push(`/items/create?id=${item.id}`)}
            >
              <View style={styles.avatar}>
                <Ionicons name="cube-outline" size={20} color={Colors.primary} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  HSN: {item.hsn_code || '—'} · Unit: {String(item.unit || 'pcs').toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.rateText}>{fmt(item.rate)}</Text>
                <View style={styles.gstBadge}>
                  <Text style={styles.gstBadgeText}>{item.gst_rate}% GST</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* BULK ADD MODAL */}
      <Modal
        visible={showBulkModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBulkModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Bulk Add Items</Text>
                <Text style={styles.modalSubtitle}>Set shared defaults, enter item details below</Text>
              </View>
              <TouchableOpacity onPress={() => setShowBulkModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {/* COMMON FIELDS */}
              <View style={styles.commonBox}>
                <Text style={styles.commonTitle}>Common for all items</Text>
                
                <Text style={styles.fieldLabel}>HSN Code</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 8471"
                  placeholderTextColor={Colors.textMuted}
                  value={bulkHsn}
                  onChangeText={setBulkHsn}
                  keyboardType="numeric"
                />

                <Text style={styles.fieldLabel}>GST Rate (%)</Text>
                <View style={styles.chipRow}>
                  {GST_RATES.map(rate => (
                    <TouchableOpacity
                      key={rate}
                      style={[styles.chip, bulkGstRate === rate && styles.chipActive]}
                      onPress={() => setBulkGstRate(rate)}
                    >
                      <Text style={[styles.chipText, bulkGstRate === rate && styles.chipTextActive]}>{rate}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Unit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {UNITS.map(u => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.chip, bulkUnit === u && styles.chipActive]}
                      onPress={() => setBulkUnit(u)}
                    >
                      <Text style={[styles.chipText, bulkUnit === u && styles.chipTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* ITEM ROWS */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableColTitle, { flex: 1 }]}>Item Name *</Text>
                <Text style={[styles.tableColTitle, { width: 100 }]}>Rate (₹) *</Text>
                <View style={{ width: 28 }} />
              </View>

              {bulkRows.map((row, idx) => (
                <View key={row.id} style={styles.tableRow}>
                  <TextInput
                    style={[styles.modalInput, { flex: 1 }]}
                    placeholder={`Item ${idx + 1}`}
                    placeholderTextColor={Colors.textMuted}
                    value={row.name}
                    onChangeText={v => handleUpdateRow(row.id, 'name', v)}
                  />
                  <TextInput
                    style={[styles.modalInput, { width: 100 }]}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={row.rate}
                    onChangeText={v => handleUpdateRow(row.id, 'rate', v)}
                  />
                  <TouchableOpacity
                    onPress={() => handleRemoveRow(row.id)}
                    disabled={bulkRows.length === 1}
                    style={{ width: 28, height: 38, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="close" size={18} color={bulkRows.length === 1 ? '#cbd5e1' : '#ef4444'} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.addRowBtn} onPress={handleAddRow}>
                <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                <Text style={styles.addRowBtnText}>+ Add Row</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowBulkModal(false)}
                disabled={savingBulk}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBulkBtn}
                onPress={handleSaveBulk}
                disabled={savingBulk}
              >
                {savingBulk ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBulkBtnText}>Save All Items</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  bulkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff7ed' },
  bulkBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, marginHorizontal: 12, marginTop: 12, marginBottom: 8, borderRadius: Radius.sm, paddingHorizontal: 12, height: 44, borderWidth: 0.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text, height: 20 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginTop: 16 },
  list: { paddingTop: 4, paddingHorizontal: 12, paddingBottom: 80, gap: 8 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  cardSub: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  rateText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  gstBadge: { backgroundColor: '#f0fdf4', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  gstBadgeText: { fontSize: 10, fontWeight: '700', color: '#16a34a' },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', flex: 1, padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  commonBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 0.5, borderColor: Colors.border },
  commonTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: Colors.text, marginTop: 6, marginBottom: 4 },
  modalInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: Colors.text },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: '#fff7ed', borderColor: Colors.primary },
  chipText: { fontSize: 12, color: Colors.text },
  chipTextActive: { fontWeight: '700', color: Colors.primary },
  tableHeader: { flexDirection: 'row', gap: 8, marginBottom: 6, paddingHorizontal: 2 },
  tableColTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  addRowBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  modalFooter: { flexDirection: 'row', gap: 10, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  saveBulkBtn: { flex: 1.5, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
  saveBulkBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

