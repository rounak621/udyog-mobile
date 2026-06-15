import { useAuth, useUser } from '@clerk/clerk-expo';
import { useEffect, useState, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

interface DashboardStats {
  total_sales: number;
  total_purchases: number;
  receivables: number;
  payables: number;
}

interface RecentInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  total_amount: number;
  status: string;
  invoice_date: string;
}

export default function DashboardScreen() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      // Step 1: Get business info
      const bizRes = await api.get('/businesses/me');
      const biz = bizRes.data;
      setBusinessName(biz.name || '');
      const businessId = biz.id;

      // Step 2: Get stats + invoices in parallel
      const [statsRes, invoiceRes] = await Promise.allSettled([
        api.get(`/reports/dashboard-stats?business_id=${businessId}`),
        api.get(`/invoices/?limit=10&sort=desc&business_id=${businessId}`),
      ]);

      if (statsRes.status === 'fulfilled') {
        const s = statsRes.value.data;
        setStats({
          total_sales: s.total_sales || 0,
          total_purchases: s.total_purchases || 0,
          receivables: s.you_will_get || s.receivables || 0,
          payables: s.you_have_to_pay || s.payables || 0,
        });
      }
      if (invoiceRes.status === 'fulfilled') {
        const invData = invoiceRes.value.data;
        setRecentInvoices(Array.isArray(invData) ? invData : Array.isArray(invData?.invoices) ? invData.invoices : Array.isArray(invData?.items) ? invData.items : []);
      }
    } catch (err) {
      console.log('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    recentInvoices.forEach((inv: any) => {
      const name = inv.customer_name || 'Unknown';
      const id = inv.customer_id || name;
      if (!map[id]) map[id] = { name, total: 0, count: 0 };
      map[id].total += Number(inv.total_amount || 0);
      map[id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 3);
  }, [recentInvoices]);

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  const initials = businessName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.bizSelector}>
          <Text style={styles.bizName} numberOfLines={1}>{businessName || 'My Business'}</Text>
          <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.topbarRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        <View style={styles.statsGrid}>
          {[
            { label: 'Total Sales', value: fmt(stats?.total_sales || 0), color: Colors.text, sub: 'this year' },
            { label: 'Total Purchases', value: fmt(stats?.total_purchases || 0), color: Colors.danger, sub: 'this year' },
            { label: 'Receivables', value: fmt(stats?.receivables || 0), color: Colors.primary, sub: 'outstanding' },
            { label: 'Payables', value: fmt(stats?.payables || 0), color: Colors.info, sub: 'outstanding' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statSub}>{s.sub}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'New Sale', icon: 'add-circle-outline', route: '/invoice/create' },
            { label: 'New Party', icon: 'people-outline', route: '/party/create' },
            { label: 'Reports', icon: 'bar-chart-outline', route: '/reports' },
          ].map(action => (
            <TouchableOpacity key={action.label} style={{ flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border }} onPress={() => router.push(action.route as any)}>
              <Ionicons name={action.icon as any} size={22} color={Colors.primary} />
              <Text style={{ fontSize: 11, color: Colors.text, fontWeight: '600', marginTop: 4 }}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/bills')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentInvoices.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No invoices yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/invoice/create')}>
                <Text style={styles.emptyBtnText}>Create First Invoice</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentInvoices.slice(0, 3).map(inv => (
              <TouchableOpacity key={inv.id} style={styles.txnCard} onPress={() => router.push(`/invoice/${inv.id}`)}>
                <View style={styles.txnIcon}>
                  <Ionicons name="business-outline" size={18} color={Colors.textSecondary} />
                </View>
                <View style={styles.txnInfo}>
                  <Text style={styles.txnName} numberOfLines={1}>{inv.customer_name || 'Unknown Party'}</Text>
                  <Text style={styles.txnSub}>{inv.invoice_number} · {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</Text>
                </View>
                <View style={styles.txnRight}>
                  <Text style={styles.txnAmount}>{fmt(inv.total_amount)}</Text>
                  <View style={[styles.badge, inv.status === 'PAID' ? styles.badgePaid : styles.badgeUnpaid]}>
                    <Text style={[styles.badgeText, inv.status === 'PAID' ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>{inv.status || 'UNPAID'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {topCustomers.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}>Top Customers</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/parties')}>
                <Text style={{ fontSize: 13, color: Colors.primary }}>View All</Text>
              </TouchableOpacity>
            </View>
            {topCustomers.map((customer, index) => (
              <View key={index} style={{ backgroundColor: Colors.card, borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>
                    {customer.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text }} numberOfLines={1}>{customer.name}</Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>{customer.count} invoice{customer.count > 1 ? 's' : ''}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>{'₹' + customer.total.toLocaleString('en-IN')}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.createFab} onPress={() => router.push('/invoice/create')}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  bizSelector: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  bizName: { fontSize: 16, fontWeight: '600', color: Colors.text, flex: 1 },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { padding: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  content: { padding: Spacing.lg, paddingBottom: 80 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  statCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 10, borderWidth: 0.5, borderColor: Colors.border, width: '48%', flex: 1, minWidth: '45%' },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 6 },
  statValue: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  statSub: { fontSize: 10, color: Colors.textMuted },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  viewAll: { fontSize: 13, color: Colors.primary },
  emptyCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 32, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border },
  emptyText: { fontSize: 14, color: Colors.textSecondary, marginTop: 8, marginBottom: 16 },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  txnCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  txnIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  txnInfo: { flex: 1, minWidth: 0 },
  txnName: { fontSize: 13, fontWeight: '500', color: Colors.text },
  txnSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  txnRight: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 13, fontWeight: '600', color: Colors.text },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  badgePaid: { backgroundColor: '#F0FDF4' },
  badgeUnpaid: { backgroundColor: '#FFF7ED' },
  badgeText: { fontSize: 9, fontWeight: '600' },
  badgeTextPaid: { color: Colors.success },
  badgeTextUnpaid: { color: '#EA580C' },
  createFab: { position: 'absolute', bottom: 90, right: 20, backgroundColor: '#F97316', borderRadius: 32, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
});
