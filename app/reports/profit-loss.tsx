import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl,
  ActivityIndicator, BackHandler
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

interface ProfitLossData {
  revenue: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
}

export default function ProfitLossReportScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ProfitLossData | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;

      const res = await api.get('/reports/profit-loss', {
        params: { business_id: bId }
      });
      setData(res.data);
    } catch (err) {
      console.log('Error loading profit-loss report:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.replace('/(tabs)/more');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
  );

  const fmt = (n: number) => {
    const isNegative = n < 0;
    const abs = Math.abs(n);
    const val = '₹' + abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    return isNegative ? `(${val})` : val;
  };

  const revenue = data?.revenue || 0;
  const cogs = data?.cogs || 0;
  const expenses = data?.expenses || 0;
  const totalExpenses = cogs + expenses;
  const netProfit = data?.net_profit || 0;
  const profitMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : '0.0';

  // Proportional bars calculation
  const totalCostForBar = totalExpenses || 1;
  const cogsPercent = ((cogs / totalCostForBar) * 100).toFixed(0);
  const expPercent = ((expenses / totalCostForBar) * 100).toFixed(0);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/more')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profit & Loss</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            colors={[Colors.primary]}
          />
        }
      >
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 13 }}>Calculating performance...</Text>
          </View>
        ) : !data ? (
          <View style={styles.empty}>
            <Ionicons name="calculator-outline" size={48} color="#cbd5e1" />
            <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 12 }}>
              Failed to load P&L statement
            </Text>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {/* Dark Navy Hero Card */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Net Profit</Text>
              <Text style={[styles.heroVal, { color: netProfit >= 0 ? '#10b981' : '#ef4444' }]}>
                {fmt(netProfit)}
              </Text>
              <View style={styles.badgeRow}>
                <View style={[styles.marginBadge, { backgroundColor: netProfit >= 0 ? '#047857' : '#b91c1c' }]}>
                  <Text style={styles.marginBadgeText}>{profitMargin}% Net Margin</Text>
                </View>
              </View>
            </View>

            {/* Income vs Expenses Cards */}
            <View style={styles.sideBySideRow}>
              <View style={[styles.summaryCard, { borderColor: '#dcfce7', backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="trending-up" size={18} color={Colors.success} />
                <Text style={styles.cardLabel}>Total Income</Text>
                <Text style={[styles.cardVal, { color: Colors.success }]}>{fmt(revenue)}</Text>
              </View>
              <View style={[styles.summaryCard, { borderColor: '#fee2e2', backgroundColor: '#fef2f2' }]}>
                <Ionicons name="trending-down" size={18} color={Colors.danger} />
                <Text style={styles.cardLabel}>Total Expenses</Text>
                <Text style={[styles.cardVal, { color: Colors.danger }]}>{fmt(totalExpenses)}</Text>
              </View>
            </View>

            {/* Expense Breakdown Bars */}
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Expense Breakdown</Text>
              
              {/* COGS (Purchases) Bar */}
              <View style={styles.barItem}>
                <View style={styles.barHeader}>
                  <Text style={styles.barLabel}>Cost of Goods Sold</Text>
                  <Text style={styles.barValue}>{fmt(cogs)} ({cogsPercent}%)</Text>
                </View>
                <View style={styles.barBackground}>
                  <View style={[styles.barFill, { width: `${cogsPercent}%` as any, backgroundColor: '#f97316' }]} />
                </View>
              </View>

              {/* Operating Expenses Bar */}
              <View style={styles.barItem}>
                <View style={styles.barHeader}>
                  <Text style={styles.barLabel}>Operating Expenses</Text>
                  <Text style={styles.barValue}>{fmt(expenses)} ({expPercent}%)</Text>
                </View>
                <View style={styles.barBackground}>
                  <View style={[styles.barFill, { width: `${expPercent}%` as any, backgroundColor: '#ef4444' }]} />
                </View>
              </View>
            </View>

            {/* Detailed Table Rows */}
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>Statement Details</Text>
              
              <View style={styles.detailRow}>
                <Text style={styles.rowName}>Revenue from Operations</Text>
                <Text style={styles.rowVal}>{fmt(revenue)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.rowName}>Cost of Goods Sold (COGS)</Text>
                <Text style={[styles.rowVal, { color: Colors.danger }]}>-{fmt(cogs)}</Text>
              </View>
              <View style={[styles.detailRow, styles.subtotalRow]}>
                <Text style={styles.rowNameBold}>Gross Profit</Text>
                <Text style={styles.rowValBold}>{fmt(data.gross_profit)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.rowName}>Operating Expenses</Text>
                <Text style={[styles.rowVal, { color: Colors.danger }]}>-{fmt(expenses)}</Text>
              </View>
              <View style={[styles.detailRow, styles.totalRow]}>
                <Text style={styles.rowNameBoldPrimary}>Net Profit</Text>
                <Text style={[styles.rowValBold, { color: netProfit >= 0 ? Colors.success : Colors.danger }]}>
                  {fmt(netProfit)}
                </Text>
              </View>
            </View>

            <Text style={styles.disclosure}>
              * Values are computed using strict accounting arithmetic. Cents are truncated.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },

  scrollList: { padding: 12, paddingBottom: 100 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200 },

  heroCard: { backgroundColor: '#0f172a', borderRadius: Radius.md, padding: 20, alignItems: 'center', gap: 6 },
  heroLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroVal: { fontSize: 32, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', marginTop: 4 },
  marginBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  marginBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  sideBySideRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, borderRadius: Radius.md, borderWidth: 1, padding: 14, gap: 4 },
  cardLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginTop: 4 },
  cardVal: { fontSize: 16, fontWeight: '700' },

  breakdownCard: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 16, gap: 12 },
  breakdownTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  barItem: { gap: 6 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  barValue: { fontSize: 11, color: Colors.text, fontWeight: '700' },
  barBackground: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },

  detailCard: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 16 },
  detailTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  subtotalRow: { borderTopWidth: 1, borderTopColor: Colors.border, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: '#F8FAFC', paddingHorizontal: 4 },
  totalRow: { borderTopWidth: 1.5, borderTopColor: '#334155', borderBottomWidth: 0, backgroundColor: '#F1F5F9', paddingHorizontal: 4, marginTop: 4 },
  rowName: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  rowVal: { fontSize: 12, color: Colors.text, fontWeight: '600' },
  rowNameBold: { fontSize: 12, color: Colors.text, fontWeight: '700' },
  rowValBold: { fontSize: 12, color: Colors.text, fontWeight: '700' },
  rowNameBoldPrimary: { fontSize: 13, color: Colors.primary, fontWeight: '700' },

  disclosure: { fontSize: 9, color: Colors.textMuted, textAlign: 'center', marginTop: 12 }
});
