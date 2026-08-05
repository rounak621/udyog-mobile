import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, RefreshControl, ActivityIndicator, Alert
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { useBusiness } from '../../context/BusinessContext';

interface RentalAsset {
  id: string;
  rental_product_id: string;
  asset_code: string;
  status: string; // AVAILABLE, ON_RENT, OVERDUE, MAINTENANCE, LOST, RETIRED
  condition: string; // EXCELLENT, GOOD, DAMAGED, WRITE_OFF
  current_rental_order_id: string | null;
  current_order_number: string | null;
  notes: string | null;
}

const STATUS_CHIPS = ['ALL', 'AVAILABLE', 'ON_RENT', 'OVERDUE', 'MAINTENANCE', 'LOST', 'RETIRED'];

export default function RentalAssetListScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { business } = useBusiness();
  const { productId, productName } = useLocalSearchParams<{ productId: string; productName: string }>();

  const [assets, setAssets] = useState<RentalAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const loadAssets = useCallback(async () => {
    if (!business?.id || !productId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await api.get(`/rental-assets/?business_id=${business.id}&rental_product_id=${productId}`);
      setAssets(res.data);
    } catch (err) {
      console.log('Error loading asset list:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [business?.id, productId, getToken]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadAssets();
    }, [loadAssets])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadAssets();
  };

  const handleUpdateStatus = async (assetId: string, newStatus: string) => {
    if (!business?.id) return;
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.put(`/rental-assets/${assetId}?business_id=${business.id}`, {
        status: newStatus
      });
      loadAssets();
    } catch (err: any) {
      console.log('Status update error:', err);
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update asset status.');
    }
  };

  const handleRetire = async (assetId: string) => {
    if (!business?.id) return;
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.post(`/rental-assets/${assetId}/retire?business_id=${business.id}`);
      loadAssets();
    } catch (err: any) {
      console.log('Asset retire error:', err);
      Alert.alert('Error', err.response?.data?.detail || 'Failed to retire asset.');
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!business?.id) return;
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.delete(`/rental-assets/${assetId}?business_id=${business.id}`);
      loadAssets();
    } catch (err: any) {
      console.log('Asset delete error:', err);
      Alert.alert('Error', err.response?.data?.detail || 'Failed to delete asset.');
    }
  };

  const confirmAction = (title: string, msg: string, action: () => void) => {
    Alert.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Proceed', onPress: action }
    ]);
  };

  const filteredAssets = useMemo(() => {
    let list = assets;
    // Status filter
    if (selectedStatus !== 'ALL') {
      list = list.filter((a) => a.status === selectedStatus);
    }
    // Search query filter
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter((a) => a.asset_code.toLowerCase().includes(q));
    }
    return list;
  }, [assets, selectedStatus, searchQuery]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return { bg: '#F0FDF4', text: '#16A34A' };
      case 'ON_RENT': return { bg: '#EFF6FF', text: '#2563EB' };
      case 'OVERDUE': return { bg: '#FEF2F2', text: '#DC2626' };
      case 'MAINTENANCE': return { bg: '#FFF7ED', text: '#EA580C' };
      case 'LOST': return { bg: '#F1F5F9', text: '#64748B' };
      case 'RETIRED': return { bg: '#F1F5F9', text: '#64748B' };
      default: return { bg: '#F1F5F9', text: '#64748B' };
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{productName || 'Asset List'}</Text>
          <Text style={styles.subtitle}>Manage unit details & maintenance</Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/rental-asset/bulk-add',
              params: { productId, productName }
            })
          }
          style={styles.headerIconBtn}
        >
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            placeholder="Search asset code..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholderTextColor={Colors.textMuted}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Status Chips Selector */}
      <View style={styles.chipsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollChips}>
          {STATUS_CHIPS.map((status) => {
            const isActive = selectedStatus === status;
            return (
              <TouchableOpacity
                key={status}
                style={[styles.chip, isActive ? styles.chipActive : null]}
                onPress={() => setSelectedStatus(status)}
              >
                <Text style={[styles.chipText, isActive ? styles.chipTextActive : null]}>
                  {status === 'ALL' ? 'All' : status.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {filteredAssets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="hardware-chip-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No assets found</Text>
          </View>
        ) : (
          filteredAssets.map((asset) => {
            const colors = getStatusColor(asset.status);
            const isAvailable = asset.status === 'AVAILABLE';
            const isMaintenance = asset.status === 'MAINTENANCE';
            const isOnRentOrOverdue = asset.status === 'ON_RENT' || asset.status === 'OVERDUE';
            const isRetiredOrLost = asset.status === 'RETIRED' || asset.status === 'LOST';

            return (
              <View key={asset.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assetCode}>{asset.asset_code}</Text>
                    {isOnRentOrOverdue && asset.current_order_number && (
                      <Text style={styles.orderLabel}>Order: {asset.current_order_number}</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.badgeText, { color: colors.text }]}>{asset.status}</Text>
                    </View>
                    <View style={styles.condBadge}>
                      <Text style={styles.condBadgeText}>{asset.condition}</Text>
                    </View>
                  </View>
                </View>

                {/* Actions Row */}
                {!isOnRentOrOverdue && (
                  <View style={styles.cardActions}>
                    {isAvailable && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() =>
                          confirmAction(
                            'Mark Maintenance',
                            `Are you sure you want to mark asset ${asset.asset_code} in maintenance?`,
                            () => handleUpdateStatus(asset.id, 'MAINTENANCE')
                          )
                        }
                      >
                        <Ionicons name="construct-outline" size={14} color={Colors.warning} />
                        <Text style={[styles.actionBtnText, { color: Colors.warning }]}>Maintenance</Text>
                      </TouchableOpacity>
                    )}

                    {isMaintenance && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() =>
                          confirmAction(
                            'Mark Available',
                            `Are you sure you want to mark asset ${asset.asset_code} as available?`,
                            () => handleUpdateStatus(asset.id, 'AVAILABLE')
                          )
                        }
                      >
                        <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
                        <Text style={[styles.actionBtnText, { color: Colors.success }]}>Mark Available</Text>
                      </TouchableOpacity>
                    )}

                    {!isRetiredOrLost && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() =>
                          confirmAction(
                            'Retire Asset',
                            `Are you sure you want to retire asset ${asset.asset_code}?`,
                            () => handleRetire(asset.id)
                          )
                        }
                      >
                        <Ionicons name="close-circle-outline" size={14} color={Colors.textSecondary} />
                        <Text style={[styles.actionBtnText, { color: Colors.textSecondary }]}>Retire</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() =>
                        confirmAction(
                          'Delete Asset',
                          `Are you sure you want to permanently delete asset ${asset.asset_code}?`,
                          () => handleDelete(asset.id)
                        )
                      }
                    >
                      <Ionicons name="trash-outline" size={14} color={Colors.danger} />
                      <Text style={[styles.actionBtnText, { color: Colors.danger }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7ED' },

  searchContainer: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.card, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 10, height: 38 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text, padding: 0 },

  chipsRow: { backgroundColor: Colors.card, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  scrollChips: { paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F1F5F9', borderWidth: 0.5, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },

  emptyCard: { backgroundColor: Colors.card, borderRadius: 12, padding: 32, alignItems: 'center', margin: 16, borderWidth: 0.5, borderColor: Colors.border },
  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 8 },

  card: { backgroundColor: Colors.card, borderRadius: 12, marginHorizontal: 16, marginTop: 12, borderWidth: 0.5, borderColor: Colors.border, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  cardHeader: { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assetCode: { fontSize: 14, fontWeight: '700', color: Colors.text },
  orderLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },

  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontWeight: '700' },
  condBadge: { backgroundColor: '#F1F5F9', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  condBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.textSecondary },

  cardActions: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderTopWidth: 0.5, borderTopColor: Colors.border, paddingVertical: 8, paddingHorizontal: 14, gap: 14 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { fontSize: 11, fontWeight: '600' }
});
