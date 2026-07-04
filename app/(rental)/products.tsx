import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, RefreshControl, ActivityIndicator
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { useBusiness } from '../../context/BusinessContext';

interface RentalProduct {
  id: string;
  name: string;
  description: string | null;
  rate: number;
  rate_type: string;
  gst_rate: number;
  hsn_code: string | null;
  is_active: boolean;
}

export default function RentalProductsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { business } = useBusiness();

  const [products, setProducts] = useState<RentalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadProducts = useCallback(async () => {
    if (!business?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const token = await getToken();
      setAuthToken(token);
      const bId = business.id;

      const res = await api.get(`/rental-products/?business_id=${bId}`);
      setProducts(res.data);
    } catch (err) {
      console.log('Error loading rental products:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [business?.id, getToken]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadProducts();
    }, [loadProducts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const getRateSuffix = (type: string) => {
    switch (type) {
      case 'DAILY': return 'day';
      case 'WEEKLY': return 'week';
      case 'MONTHLY': return 'month';
      default: return 'day';
    }
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

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
        <Text style={styles.title}>Rental Products</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/rental-product/bulk-add')}
            style={styles.headerIconBtn}
          >
            <Ionicons name="list-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/rental-product/create')}
            style={styles.headerIconBtn}
          >
            <Ionicons name="add" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            placeholder="Search products..."
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

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching products found' : 'No rental products yet'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/rental-product/create')}
              >
                <Text style={styles.emptyBtnText}>Add First Product</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredProducts.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => router.push(`/rental-product/create?id=${p.id}`)}
            >
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                {p.description ? (
                  <Text style={styles.productDesc} numberOfLines={2}>{p.description}</Text>
                ) : null}
                <View style={styles.tagsContainer}>
                  <View style={styles.tagGst}>
                    <Text style={styles.tagGstText}>{p.gst_rate}% GST</Text>
                  </View>
                  {p.hsn_code ? (
                    <View style={styles.tagHsn}>
                      <Text style={styles.tagHsnText}>HSN: {p.hsn_code}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.productRight}>
                <Text style={styles.rateAmount}>₹{Number(p.rate).toLocaleString('en-IN')}</Text>
                <Text style={styles.rateType}>per {getRateSuffix(p.rate_type)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  headerIconBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7ED' },

  searchContainer: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.card, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 10, height: 38 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text, padding: 0 },

  emptyCard: { backgroundColor: Colors.card, borderRadius: 12, padding: 32, alignItems: 'center', margin: 16, borderWidth: 0.5, borderColor: Colors.border },
  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 8, marginBottom: 16 },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  card: { backgroundColor: Colors.card, borderRadius: 12, marginHorizontal: 16, marginTop: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  productInfo: { flex: 1, marginRight: 12 },
  productName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  productDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, lineHeight: 16 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { backgroundColor: '#F1F5F9', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '500' },
  tagGst: { backgroundColor: '#EFF6FF', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagGstText: { fontSize: 10, fontWeight: '600', color: Colors.info },
  tagHsn: { backgroundColor: '#F1F5F9', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagHsnText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },

  productRight: { alignItems: 'flex-end', justifyContent: 'center' },
  rateAmount: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  rateType: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
});
