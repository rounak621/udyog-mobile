import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
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

export default function ItemsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadItems = useCallback(async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
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

  const filtered = items.filter(item => {
    return !search || item.name?.toLowerCase().includes(search.toLowerCase()) || item.hsn_code?.toLowerCase().includes(search.toLowerCase());
  });

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Items</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/items/create')}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
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
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/items/create')}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Add First Item</Text>
            </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, marginHorizontal: 12, marginTop: 12, marginBottom: 8, borderRadius: Radius.sm, paddingHorizontal: 12, height: 44, borderWidth: 0.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text, height: 20 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10, marginTop: 16 },
  list: { paddingTop: 4, paddingHorizontal: 12, paddingBottom: 80, gap: 8 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  cardSub: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  rateText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  gstBadge: { backgroundColor: '#f0fdf4', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  gstBadgeText: { fontSize: 10, fontWeight: '700', color: '#16a34a' }
});
