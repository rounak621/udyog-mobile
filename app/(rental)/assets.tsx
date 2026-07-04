import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
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
}

interface AssetSummary {
  total: number;
  available: number;
  on_rent: number;
  overdue: number;
  maintenance: number;
  lost: number;
}

interface ProductAssetStats {
  productId: string;
  productName: string;
  total: number;
  available: number;
  onRent: number;
  overdue: number;
  maintenance: number;
  utilization: number;
}

export default function RentalAssetsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { business } = useBusiness();

  const [products, setProducts] = useState<RentalProduct[]>([]);
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [productStats, setProductStats] = useState<ProductAssetStats[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!business?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const token = await getToken();
      setAuthToken(token);
      const bId = business.id;

      // 1. Fetch products & overall summary in parallel
      const [prodRes, summaryRes] = await Promise.all([
        api.get(`/rental-products/?business_id=${bId}`),
        api.get(`/rental-assets/summary?business_id=${bId}`)
      ]);

      const productList = prodRes.data;
      setProducts(productList);
      setSummary(summaryRes.data);

      // 2. Fetch assets list for each product to calculate counts and utilization
      const statsList: ProductAssetStats[] = await Promise.all(
        productList.map(async (prod: RentalProduct) => {
          const assetsRes = await api.get(`/rental-assets/?business_id=${bId}&rental_product_id=${prod.id}`);
          const assets = assetsRes.data;
          const total = assets.length;
          const available = assets.filter((a: any) => a.status === 'AVAILABLE').length;
          const onRent = assets.filter((a: any) => a.status === 'ON_RENT').length;
          const overdue = assets.filter((a: any) => a.status === 'OVERDUE').length;
          const maintenance = assets.filter((a: any) => a.status === 'MAINTENANCE').length;
          const utilization = total > 0 ? Math.round((onRent / total) * 100) : 0;

          return {
            productId: prod.id,
            productName: prod.name,
            total,
            available,
            onRent,
            overdue,
            maintenance,
            utilization
          };
        })
      );

      setProductStats(statsList);
    } catch (err) {
      console.log('Error loading rental assets:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [business?.id, getToken]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
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
        <Text style={styles.title}>Asset Management</Text>
        {products.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(rental)/asset-bulk-add')}
            style={styles.headerIconBtn}
          >
            <Ionicons name="add" size={24} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {products.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="hardware-chip-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Add rental products first to manage assets</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/(rental)/products')}
            >
              <Text style={styles.emptyBtnText}>Go to Products</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Overall totals row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingVertical: 12 }}>
              {[
                { label: 'Total Assets', value: summary?.total || 0, color: Colors.primary },
                { label: 'Available', value: summary?.available || 0, color: Colors.success },
                { label: 'On Rent', value: summary?.on_rent || 0, color: Colors.info },
                { label: 'Maintenance', value: summary?.maintenance || 0, color: Colors.warning }
              ].map((card) => (
                <View key={card.label} style={styles.summaryCard}>
                  <View style={[styles.summaryDot, { backgroundColor: card.color }]} />
                  <Text style={styles.summaryLabel}>{card.label}</Text>
                  <Text style={[styles.summaryValue, { color: card.color }]}>{card.value}</Text>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Product Inventory</Text>

            {/* Grid Layout of products */}
            <View style={styles.gridContainer}>
              {productStats.map((stat) => (
                <TouchableOpacity
                  key={stat.productId}
                  style={styles.gridCard}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push({
                      pathname: '/(rental)/asset-list',
                      params: { productId: stat.productId, productName: stat.productName }
                    })
                  }
                >
                  <Text style={styles.cardProdName} numberOfLines={1}>
                    {stat.productName}
                  </Text>
                  <Text style={styles.cardTotalNumber}>{stat.total}</Text>
                  <Text style={styles.cardTotalLabel}>total asset{stat.total !== 1 ? 's' : ''}</Text>

                  {/* Stat Breakdowns */}
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>Avail</Text>
                      <Text style={[styles.breakdownVal, { color: Colors.success }]}>{stat.available}</Text>
                    </View>
                    <View style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>Rent</Text>
                      <Text style={[styles.breakdownVal, { color: Colors.info }]}>{stat.onRent}</Text>
                    </View>
                    <View style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>Maint</Text>
                      <Text style={[styles.breakdownVal, { color: Colors.warning }]}>{stat.maintenance}</Text>
                    </View>
                  </View>

                  {/* Utilization Progress Bar */}
                  <View style={styles.utilizationContainer}>
                    <View style={styles.utilTitleRow}>
                      <Text style={styles.utilLabel}>Utilization</Text>
                      <Text style={styles.utilPercent}>{stat.utilization}%</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${stat.utilization}%` }]} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  headerIconBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7ED' },

  emptyCard: { backgroundColor: Colors.card, borderRadius: 12, padding: 32, alignItems: 'center', margin: 16, borderWidth: 0.5, borderColor: Colors.border },
  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 8, marginBottom: 16, textAlign: 'center' },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  summaryCard: { width: 120, padding: 10, backgroundColor: Colors.card, borderRadius: 10, borderWidth: 0.5, borderColor: Colors.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  summaryDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute' as const, top: 8, right: 8 },
  summaryLabel: { fontSize: 10, color: Colors.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '700' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginHorizontal: 16, marginBottom: 10 },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  gridCard: { width: '47%', flexGrow: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: Colors.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  cardProdName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  cardTotalNumber: { fontSize: 20, fontWeight: '800', color: Colors.text, marginTop: 2 },
  cardTotalLabel: { fontSize: 11, color: Colors.textSecondary },

  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 10, marginTop: 10 },
  breakdownItem: { alignItems: 'center' },
  breakdownLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '500' },
  breakdownVal: { fontSize: 12, fontWeight: '700', marginTop: 2 },

  utilizationContainer: { marginTop: 12 },
  utilTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  utilLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '500' },
  utilPercent: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  progressBarBg: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary },
});
