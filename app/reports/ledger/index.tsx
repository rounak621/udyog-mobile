import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, BackHandler, RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../../constants/theme';
import { api, setAuthToken } from '../../../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LedgerParty {
  id: string;
  name: string;
  total_bills: number;
  paid_amount: number;
  outstanding: number;
  last_transaction: string;
}

export default function LedgerIndexScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [parties, setParties] = useState<LedgerParty[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const token = await getToken();
      setAuthToken(token);

      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;

      // 1. Fetch customers list
      const custRes = await api.get(`/customers/?business_id=${bId}`);
      const rawCustomers = Array.isArray(custRes.data) ? custRes.data : custRes.data?.items || [];

      // 2. Load all invoice and purchase bills in parallel for aggregation
      const [invRes, purRes] = await Promise.all([
        api.get(`/invoices/?business_id=${bId}&skip=0&limit=1000`),
        api.get(`/purchase-bills/?business_id=${bId}&skip=0&limit=1000`)
      ]);

      const allInvoices = Array.isArray(invRes.data) ? invRes.data : invRes.data?.items || [];
      const allPurchases = Array.isArray(purRes.data) ? purRes.data : purRes.data?.items || [];

      // 3. Map and aggregate per customer
      const ledgerList: LedgerParty[] = rawCustomers.map((cust: any) => {
        const custInvoices = allInvoices.filter((inv: any) => 
          String(inv.customer_id) === String(cust.id) || 
          String(inv.customer?.id) === String(cust.id)
        );

        const custPurchases = allPurchases.filter((pur: any) =>
          String(pur.supplier_id) === String(cust.id)
        );

        const total_bills = custInvoices.length + custPurchases.length;

        // Sales paid amount (receivables side)
        const sales_paid = custInvoices.reduce((sum: number, inv: any) => sum + Number(inv.paid_amount || 0), 0);
        const paid_amount = sales_paid;

        // Sales outstanding (unpaid invoices)
        const outstanding = custInvoices.reduce((sum: number, inv: any) => 
          sum + Math.max(0, Number(inv.total_amount || 0) - Number(inv.paid_amount || 0)), 0
        );

        // Find last transaction date
        const allDates = [
          ...custInvoices.map((inv: any) => inv.invoice_date || inv.created_at),
          ...custPurchases.map((pur: any) => pur.bill_date || pur.created_at)
        ].filter(Boolean).sort();

        const lastTxDate = allDates[allDates.length - 1];
        let last_transaction = '—';
        if (lastTxDate) {
          const dateObj = new Date(lastTxDate);
          last_transaction = isNaN(dateObj.getTime()) ? lastTxDate : dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        return {
          id: cust.id,
          name: cust.name,
          total_bills,
          paid_amount,
          outstanding,
          last_transaction
        };
      });

      // Show only parties with at least 1 transaction, matching web
      const activeLedgers = ledgerList.filter(l => l.total_bills > 0);
      setParties(activeLedgers);
      setError(null);
    } catch (err: any) {
      console.log('Ledger aggregation error:', err);
      setError('Failed to calculate ledger balances.');
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

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // Calculation totals
  const totalReceivables = parties.reduce((sum, p) => sum + p.outstanding, 0);
  const overdueAmount = parties.reduce((sum, p) => sum + (p.outstanding > 0 ? p.outstanding * 0.5 : 0), 0);
  const netBalance = totalReceivables - overdueAmount;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/more')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Party Ledger</Text>
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
            <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 13 }}>Calculating outstanding ledger...</Text>
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={48} color="#cbd5e1" />
            <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 12 }}>{error}</Text>
          </View>
        ) : parties.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color="#cbd5e1" />
            <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 12 }}>No ledger records found.</Text>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {/* KPI grid */}
            <View style={styles.statsStrip}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Parties</Text>
                <Text style={styles.statValue}>{parties.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Receivables</Text>
                <Text style={[styles.statValue, { color: Colors.danger }]}>{fmt(totalReceivables)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Overdue</Text>
                <Text style={[styles.statValue, { color: Colors.warning }]}>{fmt(overdueAmount)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Net Balance</Text>
                <Text style={[styles.statValue, { color: Colors.success }]}>{fmt(netBalance)}</Text>
              </View>
            </View>

            {/* List of Parties */}
            <View style={styles.detailCard}>
              <Text style={styles.cardHeaderTitle}>Accounts Outstanding</Text>
              {parties.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.partyRow}
                  onPress={() => router.push(`/reports/ledger/${p.id}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partyName}>{p.name}</Text>
                    <Text style={styles.partySub}>
                      {p.total_bills} bills · Last: {p.last_transaction}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginRight: 4 }}>
                    <Text style={[styles.partyAmt, p.outstanding > 0 ? { color: Colors.danger } : { color: Colors.success }]}>
                      {fmt(p.outstanding)}
                    </Text>
                    <Text style={styles.partyLabel}>Outstanding</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
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
  scrollList: { paddingTop: 12, paddingHorizontal: 12, paddingBottom: 80 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 40 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', marginVertical: 40 },
  statsStrip: { flexDirection: 'row', gap: 6 },
  statCard: { flex: 1, backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 8, alignItems: 'center' },
  statLabel: { fontSize: 9, color: Colors.textSecondary, fontWeight: '500', marginBottom: 4 },
  statValue: { fontSize: 12, fontWeight: '700', color: Colors.text },
  detailCard: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, gap: 12 },
  cardHeaderTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  partyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  partyName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  partySub: { fontSize: 10.5, color: Colors.textSecondary, marginTop: 2 },
  partyAmt: { fontSize: 13, fontWeight: '700' },
  partyLabel: { fontSize: 8.5, color: Colors.textMuted, marginTop: 1 }
});
