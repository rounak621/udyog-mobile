import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, BackHandler
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeScrollView } from '../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

export default function ReportsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      
      const res = await api.get(`/reports/dashboard-stats?business_id=${bId}`);
      setStats(res.data);
    } catch (err) {
      console.log('Reports summary error:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

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

  const formatIndianStyle = (n: number) => {
    if (!n) return '₹0';
    const abs = Math.abs(n);
    const isNegative = n < 0;
    let formatted = '';
    if (abs >= 10000000) {
      formatted = (abs / 10000000).toFixed(2) + 'Cr';
    } else if (abs >= 100000) {
      formatted = (abs / 100000).toFixed(2) + 'L';
    } else if (abs >= 1000) {
      formatted = (abs / 1000).toFixed(1) + 'K';
    } else {
      formatted = abs.toString();
    }
    formatted = formatted.replace(/\.0+([A-Za-z]+)$/, '$1');
    formatted = formatted.replace(/(\.[0-9])0+([A-Za-z]+)$/, '$1$2');
    return (isNegative ? '-₹' : '₹') + formatted;
  };

  const reports = [
    { icon: 'trending-up-outline', title: 'Sales Report', sub: 'Invoice-wise sales summary', color: Colors.primary, route: '/reports/sales' },
    { icon: 'trending-down-outline', title: 'Purchase Report', sub: 'Purchase bill summary', color: Colors.info, route: '/reports/purchase' },
    { icon: 'people-outline', title: 'Party Ledger', sub: 'Customer & supplier ledger', color: Colors.success, route: '/reports/ledger' },
    { icon: 'book-outline', title: 'Day Book', sub: 'Master ledger of all accounts', color: '#14b8a6', route: '/reports/day-book' },
    { icon: 'receipt-outline', title: 'GSTR-1', sub: 'Outward supplies summary', color: '#8b5cf6', route: '/reports/gstr1' },
    { icon: 'bar-chart-outline', title: 'Profit & Loss', sub: 'Income vs expense', color: Colors.danger, route: '/reports/profit-loss' },
  ];

  const handlePressReport = (r: typeof reports[0]) => {
    const activeRoutes = [
      '/reports/sales',
      '/reports/purchase',
      '/reports/profit-loss',
      '/reports/day-book',
      '/reports/ledger',
      '/reports/gstr1'
    ];
    if (activeRoutes.includes(r.route)) {
      router.push(r.route as any);
    } else {
      Alert.alert('Coming Soon', `${r.title} report will be available in the next update.`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/more')} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Reports</Text>
      </View>

      <SafeScrollView baseBottomPadding={40} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary cards */}
        {loading ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} /> : (
          <View style={styles.summaryRow}>
            {[
              { label: 'Total Sales', value: formatIndianStyle(stats?.total_sales || 0), color: Colors.primary },
              { label: 'Total Purchases', value: formatIndianStyle(stats?.total_purchases || 0), color: Colors.info },
              { label: 'Receivables', value: formatIndianStyle(stats?.you_will_get || 0), color: Colors.success },
              { label: 'Payables', value: formatIndianStyle(stats?.you_have_to_pay || 0), color: Colors.danger },
            ].map(s => (
              <View key={s.label} style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{s.label}</Text>
                <Text style={[styles.summaryValue, { color: s.color }]} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Available Reports</Text>
        <View style={styles.reportsGrid}>
          {reports.map(r => (
            <TouchableOpacity key={r.title} style={styles.reportCard} onPress={() => handlePressReport(r)}>
              <View style={[styles.reportIcon, { backgroundColor: r.color + '15' }]}>
                <Ionicons name={r.icon as any} size={24} color={r.color} />
              </View>
              <Text style={styles.reportTitle}>{r.title}</Text>
              <Text style={styles.reportSub}>{r.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { padding: 12, paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  summaryCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border, width: '47%', flex: 1 },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 6 },
  summaryValue: { fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  reportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reportCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border, width: '47%', flex: 1, minWidth: '45%' },
  reportIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  reportTitle: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  reportSub: { fontSize: 11, color: Colors.textSecondary, lineHeight: 15 },
});
