import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../constants/theme';
import { api, setAuthToken } from '../services/api';

export default function ReportsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const res = await api.get('/reports/summary');
        setStats(res.data);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  const reports = [
    { icon: 'trending-up-outline', title: 'Sales Report', sub: 'Invoice-wise sales summary', color: Colors.primary, route: '/reports/sales' },
    { icon: 'trending-down-outline', title: 'Purchase Report', sub: 'Purchase bill summary', color: Colors.info, route: '/reports/purchases' },
    { icon: 'people-outline', title: 'Party Ledger', sub: 'Customer & supplier ledger', color: Colors.success, route: '/reports/ledger' },
    { icon: 'receipt-outline', title: 'GSTR-1', sub: 'Outward supplies summary', color: '#8b5cf6', route: '/reports/gstr1' },
    { icon: 'calculator-outline', title: 'GSTR-3B', sub: 'Monthly GST summary', color: '#f59e0b', route: '/reports/gstr3b' },
    { icon: 'bar-chart-outline', title: 'Profit & Loss', sub: 'Income vs expense', color: Colors.danger, route: '/reports/pl' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Reports</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary cards */}
        {loading ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} /> : (
          <View style={styles.summaryRow}>
            {[
              { label: 'Total Sales', value: fmt(stats?.total_sales || 0), color: Colors.primary },
              { label: 'Total Purchases', value: fmt(stats?.total_purchases || 0), color: Colors.info },
              { label: 'Receivables', value: fmt(stats?.receivables || 0), color: Colors.success },
              { label: 'Payables', value: fmt(stats?.payables || 0), color: Colors.danger },
            ].map(s => (
              <View key={s.label} style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{s.label}</Text>
                <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Available Reports</Text>
        <View style={styles.reportsGrid}>
          {reports.map(r => (
            <TouchableOpacity key={r.title} style={styles.reportCard} onPress={() => Alert.alert('Coming Soon', `${r.title} report will be available in the next update.`)}>
              <View style={[styles.reportIcon, { backgroundColor: r.color + '15' }]}>
                <Ionicons name={r.icon as any} size={24} color={r.color} />
              </View>
              <Text style={styles.reportTitle}>{r.title}</Text>
              <Text style={styles.reportSub}>{r.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { padding: 12, paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  summaryCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: Colors.border, width: '47%', flex: 1 },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 6 },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  reportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reportCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border, width: '47%', flex: 1 },
  reportIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  reportTitle: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  reportSub: { fontSize: 11, color: Colors.textSecondary, lineHeight: 15 },
});
