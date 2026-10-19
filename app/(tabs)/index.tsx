import { useAuth, useUser } from '@clerk/clerk-expo';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, ActivityIndicator
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeScrollView, useBottomPadding } from '../../components/ui/SafeLayout';
import Svg, { Rect, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { Colors } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { showApiError } from '../../utils/apiError';
import { useBusiness } from '../../context/BusinessContext';
import { useAppMode } from '../../context/AppModeContext';
import BusinessSwitcherModal from '../../components/BusinessSwitcherModal';

interface DashboardStats {
  total_sales: number;
  total_purchases: number;
  receivables: number;
  payables: number;
  unpaidCount: number;
}

interface MonthlyStat {
  name: string;
  Sales: number;
  Purchases: number;
}

interface ExpenseCategorySummary {
  category: string;
  total_amount: number;
  count: number;
}

interface ExpenseBreakdownData {
  total_amount: number;
  categories: ExpenseCategorySummary[];
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
  const { business, refreshBusinesses } = useBusiness();
  const { setMode } = useAppMode();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdownData | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(320);

  const loadData = async () => {
    if (!business?.id) return;
    try {
      const token = await getToken();
      setAuthToken(token);
      const businessId = business.id;

      const now = new Date();
      const mStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const mEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // Step 2: Get stats + invoices + notifications + charts + expenses breakdown in parallel
      const [statsRes, invoiceRes, notifRes, chartsRes, expenseBreakdownRes] = await Promise.allSettled([
        api.get(`/reports/dashboard-stats?business_id=${businessId}`),
        api.get(`/invoices/?limit=10&sort=desc&business_id=${businessId}`),
        api.get(`/notifications?business_id=${businessId}&limit=50`),
        api.get(`/reports/dashboard-charts?business_id=${businessId}`),
        api.get(`/expenses/breakdown?business_id=${businessId}&start_date=${mStart}&end_date=${mEnd}`),
      ]);

      if (statsRes.status === 'fulfilled') {
        const s = statsRes.value.data;
        setStats({
          total_sales: s.total_sales || 0,
          total_purchases: s.total_purchases || 0,
          receivables: s.you_will_get || s.receivables || 0,
          payables: s.you_have_to_pay || s.payables || 0,
          unpaidCount: s.unpaid_invoice_count || 0,
        });
      }
      if (invoiceRes.status === 'fulfilled') {
        const invData = invoiceRes.value.data;
        setRecentInvoices(Array.isArray(invData) ? invData : Array.isArray(invData?.invoices) ? invData.invoices : Array.isArray(invData?.items) ? invData.items : []);
      }
      if (notifRes.status === 'fulfilled') {
        const notifs = notifRes.value.data;
        if (Array.isArray(notifs)) {
          const count = notifs.filter((n: any) => n.read_at === null).length;
          setUnreadCount(count);
        }
      }
      if (chartsRes.status === 'fulfilled') {
        const cData = chartsRes.value.data;
        setMonthlyStats(Array.isArray(cData?.monthlyStats) ? cData.monthlyStats : []);
      }
      if (expenseBreakdownRes.status === 'fulfilled') {
        const ebData = expenseBreakdownRes.value.data;
        setExpenseBreakdown({
          total_amount: Number(ebData?.total_amount || 0),
          categories: Array.isArray(ebData?.categories) ? ebData.categories : [],
        });
      }
    } catch (err) {
      console.log('Dashboard load error:', err);
      showApiError(err, 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [business?.id])
  );

  useEffect(() => {
    if (business?.id) {
      loadData();
    }
  }, [business?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadData(), refreshBusinesses()]);
    } finally {
      setRefreshing(false);
    }
  };

  const getInitials = (name: string) => name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

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

  const compactFmt = (n: number) => {
    const num = Number(n || 0);
    if (num >= 100000) return '₹' + (num / 100000).toFixed(2) + 'L';
    if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K';
    return '₹' + num.toLocaleString('en-IN');
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const gstinVal = business?.gst_number || (business as any)?.gstin;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowSwitcher(true)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.bizName}>{business?.name || 'My Business'}</Text>
            <Ionicons name="chevron-down" size={16} color="#0F172A" />
          </View>
          <Text style={styles.bizSub} textBreakStrategy="simple">
            {gstinVal ? `GSTIN · ${business?.state || ''}` : business?.state || ''}
          </Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color="#0F172A" />
            {unreadCount > 0 && <View style={styles.badgeDot} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{(business?.name || 'U').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <SafeScrollView
        baseBottomPadding={140}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        <View style={styles.heroCard}>
          <View style={{ position: 'absolute', bottom: 70, right: -10, flexDirection: 'row', gap: 4, opacity: 0.5 }}>
            <View style={{ width: 14, height: 22, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <View style={{ width: 14, height: 28, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <View style={{ width: 14, height: 34, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)' }} />
            <View style={{ width: 14, height: 40, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <View style={{ width: 14, height: 46, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' }} />
            <View style={{ width: 14, height: 52, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' }} />
            <View style={{ width: 14, height: 58, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
              <Text style={styles.heroLabel}>RECEIVABLES</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Outstanding</Text>
            </View>
          </View>
          <Text style={styles.heroAmount}>₹{Number(stats?.receivables || 0).toLocaleString('en-IN')}</Text>
          <Text style={styles.heroSub}>from {stats?.unpaidCount || 0} unpaid invoices</Text>
          <TouchableOpacity style={styles.heroBtn} onPress={() => router.push({ pathname: '/(tabs)/bills', params: { initialFilter: 'Receivables' } })}>
            <Ionicons name="eye-outline" size={16} color="#0F172A" />
            <Text style={styles.heroBtnText}>Receivables</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statItem}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/bills')}
          >
            <Text style={styles.statLabel} maxFontSizeMultiplier={1.2} numberOfLines={1}>SALES</Text>
            <Text style={[styles.statValue, { color: '#16A34A' }]} maxFontSizeMultiplier={1.2} numberOfLines={1}>{compactFmt(stats?.total_sales || 0)}</Text>
            <Text style={styles.statSub} maxFontSizeMultiplier={1.2}>this year</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statItem}
            activeOpacity={0.7}
            onPress={() => router.push('/purchase-bills')}
          >
            <Text style={styles.statLabel} maxFontSizeMultiplier={1.2} numberOfLines={1}>PURCHASES</Text>
            <Text style={styles.statValue} maxFontSizeMultiplier={1.2} numberOfLines={1}>{compactFmt(stats?.total_purchases || 0)}</Text>
            <Text style={styles.statSub} maxFontSizeMultiplier={1.2}>this year</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statItem}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/purchase-bills', params: { initialFilter: 'Payables' } })}
          >
            <Text style={styles.statLabel} maxFontSizeMultiplier={1.2} numberOfLines={1}>PAYABLES</Text>
            <Text style={[styles.statValue, { color: '#C2410C' }]} maxFontSizeMultiplier={1.2} numberOfLines={1}>{compactFmt(stats?.payables || 0)}</Text>
            <Text style={styles.statSub} maxFontSizeMultiplier={1.2}>to pay</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/invoice/create')}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="add" size={20} color="#F97316" />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>New Sale</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/party/create')}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="people-outline" size={18} color="#F97316" />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>New Party</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/expenses' as any)}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="wallet-outline" size={18} color="#F97316" />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>Expenses</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/inventory')}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="cube-outline" size={18} color="#F97316" />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>Inventory</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/bills')}>
              <Text style={styles.viewAll}>View all</Text>
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
            recentInvoices.slice(0, 3).map((inv: any) => (
              <TouchableOpacity key={inv.id} style={styles.txnCard} onPress={() => router.push(`/invoice/${inv.id}`)}>
                <View style={styles.avatarCircleSmall}>
                  <Text style={styles.avatarSmallText}>{getInitials(inv.customer_name)}</Text>
                </View>
                <View style={styles.txnInfo}>
                  <Text style={styles.txnName} numberOfLines={1}>{inv.customer_name || 'Unknown Party'}</Text>
                  <Text style={styles.txnSub} textBreakStrategy="simple">{inv.invoice_number} · {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</Text>
                </View>
                <View style={styles.txnRight}>
                  <Text style={styles.txnAmount}>{fmt(inv.total_amount)}</Text>
                  <View style={[styles.badge, (inv.payment_status || inv.status) === 'PAID' ? styles.badgePaid : (inv.payment_status || inv.status) === 'PARTIAL' ? styles.badgePartial : styles.badgeUnpaid]}>
                    <Text style={[styles.badgeText, (inv.payment_status || inv.status) === 'PAID' ? styles.badgeTextPaid : (inv.payment_status || inv.status) === 'PARTIAL' ? styles.badgeTextPartial : styles.badgeTextUnpaid]}>{inv.payment_status || inv.status || 'UNPAID'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {topCustomers.length > 0 && (
          <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}>Top Customers</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/parties')}>
                <Text style={{ fontSize: 13, color: Colors.primary }}>View all</Text>
              </TouchableOpacity>
            </View>
            {topCustomers.map((customer, index) => (
              <View key={index} style={{ backgroundColor: Colors.card, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>
                    {customer.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text }} numberOfLines={1}>{customer.name}</Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }} textBreakStrategy="simple">{customer.count} invoice{customer.count > 1 ? 's' : ''}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>{'₹' + customer.total.toLocaleString('en-IN')}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Sales vs Purchases Bar Chart */}
        <View style={styles.chartCard} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
          <View style={styles.chartCardHeader}>
            <Text style={styles.chartCardTitle}>Sales vs Purchases</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#FF7A1A' }} />
                <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>Sales</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#2F9BFF' }} />
                <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>Purchases</Text>
              </View>
            </View>
          </View>
          <View style={{ paddingVertical: 12, paddingHorizontal: 10 }}>
            {monthlyStats.length === 0 ? (
              <View style={{ height: 140, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, color: '#94A3B8' }}>No sales or purchase data yet</Text>
              </View>
            ) : (() => {
              const svgW = Math.max(chartWidth - 20, 240);
              const svgH = 160;
              const top = 12;
              const bottom = 24;
              const left = 44;
              const right = 8;
              const plotW = Math.max(svgW - left - right, 100);
              const plotH = svgH - top - bottom;
              const maxVal = Math.max(
                ...monthlyStats.map(m => Math.max(Number(m.Sales) || 0, Number(m.Purchases) || 0)),
                100
              );
              const y0 = top + plotH;
              const yMid = top + plotH / 2;
              const yMax = top;
              const colCount = monthlyStats.length;
              const colW = plotW / colCount;
              const barW = Math.max(Math.min(12, (colW - 6) / 2), 4);

              return (
                <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
                  {/* Grid Lines */}
                  <Line x1={left} y1={y0} x2={svgW - right} y2={y0} stroke="#E2E8F0" strokeWidth="1" />
                  <Line x1={left} y1={yMid} x2={svgW - right} y2={yMid} stroke="#E2E8F0" strokeDasharray="3,3" strokeWidth="1" />
                  <Line x1={left} y1={yMax} x2={svgW - right} y2={yMax} stroke="#E2E8F0" strokeDasharray="3,3" strokeWidth="1" />

                  {/* Y-axis Labels */}
                  <SvgText x={left - 4} y={yMax + 4} fontSize="9" fill="#94A3B8" textAnchor="end">
                    {compactFmt(maxVal)}
                  </SvgText>
                  <SvgText x={left - 4} y={yMid + 4} fontSize="9" fill="#94A3B8" textAnchor="end">
                    {compactFmt(maxVal / 2)}
                  </SvgText>
                  <SvgText x={left - 4} y={y0 + 3} fontSize="9" fill="#94A3B8" textAnchor="end">
                    ₹0
                  </SvgText>

                  {/* Month Columns & Bars */}
                  {monthlyStats.map((item, idx) => {
                    const centerX = left + idx * colW + colW / 2;
                    const salesH = maxVal > 0 ? ((Number(item.Sales) || 0) / maxVal) * plotH : 0;
                    const purchasesH = maxVal > 0 ? ((Number(item.Purchases) || 0) / maxVal) * plotH : 0;

                    return (
                      <G key={item.name || String(idx)}>
                        {/* Sales Bar */}
                        <Rect
                          x={centerX - barW - 1}
                          y={y0 - salesH}
                          width={barW}
                          height={Math.max(salesH, 0)}
                          fill="#FF7A1A"
                          rx={2}
                        />
                        {/* Purchases Bar */}
                        <Rect
                          x={centerX + 1}
                          y={y0 - purchasesH}
                          width={barW}
                          height={Math.max(purchasesH, 0)}
                          fill="#2F9BFF"
                          rx={2}
                        />
                        {/* Month Label */}
                        <SvgText x={centerX} y={svgH - 6} fontSize="10" fill="#64748B" textAnchor="middle">
                          {item.name}
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>
              );
            })()}
          </View>
        </View>

        {/* Expenses by Category Donut */}
        <View style={styles.chartCard}>
          <View style={styles.chartCardHeader}>
            <Text style={styles.chartCardTitle}>Expenses by category</Text>
            <TouchableOpacity onPress={() => router.push('/expenses' as any)}>
              <Text style={{ color: '#FF7A1A', fontWeight: '700', fontSize: 13 }}>View all</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            {(() => {
              const categories = expenseBreakdown?.categories || [];
              const totalAmount = expenseBreakdown?.total_amount || 0;
              const totalCount = categories.reduce((sum, c) => sum + (c.count || 0), 0);
              const R = 45;
              const circumference = 2 * Math.PI * R;
              const DONUT_COLORS = ['#FF7A1A', '#2F9BFF', '#A855F7', '#22C55E', '#F59E0B'];

              if (categories.length === 0 || totalAmount === 0) {
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 120, height: 120, position: 'relative', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Svg width={120} height={120} viewBox="0 0 120 120">
                        <Circle cx={60} cy={60} r={R} stroke="#EEF0F5" strokeWidth={18} fill="none" />
                      </Svg>
                      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#1B1F24' }}>₹0</Text>
                        <Text style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>0 expenses</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#1B1F24', marginBottom: 4 }}>No expenses this month</Text>
                      <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 17, marginBottom: 8 }}>
                        Your category split will appear here once you record an expense.
                      </Text>
                      <TouchableOpacity onPress={() => router.push('/expenses/create' as any)}>
                        <Text style={{ color: '#FF7A1A', fontWeight: '700', fontSize: 13 }}>+ Add expense</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              let accumulatedOffset = 0;
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 120, height: 120, position: 'relative', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Svg width={120} height={120} viewBox="0 0 120 120">
                      <G rotation="-90" origin="60, 60">
                        {categories.map((cat, idx) => {
                          const pct = totalAmount > 0 ? (Number(cat.total_amount) / totalAmount) : 0;
                          const strokeDash = pct * circumference;
                          const strokeOffset = -accumulatedOffset;
                          accumulatedOffset += strokeDash;

                          return (
                            <Circle
                              key={cat.category || String(idx)}
                              cx={60}
                              cy={60}
                              r={R}
                              stroke={DONUT_COLORS[idx % DONUT_COLORS.length]}
                              strokeWidth={18}
                              strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                              strokeDashoffset={strokeOffset}
                              fill="none"
                            />
                          );
                        })}
                      </G>
                    </Svg>
                    <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#1B1F24' }}>{compactFmt(totalAmount)}</Text>
                      <Text style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>
                        {totalCount} {totalCount === 1 ? 'expense' : 'expenses'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, marginLeft: 16, justifyContent: 'center' }}>
                    {categories.slice(0, 5).map((cat, idx) => (
                      <View key={cat.category || String(idx)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length], marginRight: 6 }} />
                        <Text style={{ flex: 1, fontSize: 12, color: '#475569' }} numberOfLines={1}>{cat.category}</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A', marginLeft: 6 }}>
                          ₹{Math.round(Number(cat.total_amount)).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </SafeScrollView>

      <TouchableOpacity style={styles.createFab} onPress={() => router.push('/invoice/create')}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginLeft: 4 }}>New Invoice</Text>
      </TouchableOpacity>

      <BusinessSwitcherModal
        visible={showSwitcher}
        onClose={() => setShowSwitcher(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: Colors.card, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bizName: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  bizSub: { fontSize: 12, color: '#94A3B8', marginTop: 2, flexShrink: 1 },
  bellBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  badgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
  },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  heroCard: { backgroundColor: '#F97316', borderRadius: 20, padding: 20, marginHorizontal: 16, marginTop: 16, marginBottom: 16, position: 'relative', overflow: 'hidden' },
  heroLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: 1 },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  heroBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  heroAmount: { fontSize: 34, fontWeight: '800', color: '#fff', marginTop: 12 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4, marginBottom: 16 },
  heroBtn: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroBtnText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },

  statsRow: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginBottom: 16, padding: 16, flexDirection: 'row', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#E2E8F0' },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 4, minHeight: 14, textAlign: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#0F172A', minHeight: 20 },
  statSub: { fontSize: 10, color: '#94A3B8', marginTop: 2, minHeight: 26, textAlign: 'center' },

  quickActionsRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 20 },
  quickAction: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  quickActionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickActionLabel: { fontSize: 12, fontWeight: '700', color: '#0F172A', textAlign: 'center' },

  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  viewAll: { fontSize: 13, color: Colors.primary },
  emptyCard: { backgroundColor: Colors.card, borderRadius: 12, padding: 32, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border },
  emptyText: { fontSize: 14, color: Colors.textSecondary, marginTop: 8, marginBottom: 16 },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  txnCard: { backgroundColor: Colors.card, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  txnIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  txnInfo: { flex: 1, minWidth: 0 },
  txnName: { fontSize: 13, fontWeight: '500', color: Colors.text },
  txnSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2, flexShrink: 1 },
  txnRight: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 13, fontWeight: '600', color: Colors.text },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  badgePaid: { backgroundColor: '#F0FDF4' },
  badgeUnpaid: { backgroundColor: '#FFF7ED' },
  badgePartial: { backgroundColor: '#EFF6FF' },
  badgeText: { fontSize: 9, fontWeight: '600' },
  badgeTextPaid: { color: '#16A34A' },
  badgeTextUnpaid: { color: '#C2410C' },
  badgeTextPartial: { color: '#2563EB' },
  createFab: { position: 'absolute', bottom: 24, right: 16, flexDirection: 'row', height: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  avatarCircleSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  avatarSmallText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 16,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  chartCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  chartCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
});
