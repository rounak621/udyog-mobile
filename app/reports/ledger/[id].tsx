import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, BackHandler, RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../../constants/theme';
import { api, setAuthToken } from '../../../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LedgerLine {
  transaction_date: string;
  narration: string;
  debit: string;
  credit: string;
  running_balance: string;
  balance_type: string;
}

export default function LedgerDetailScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [partyName, setPartyName] = useState('Unknown Party');
  const [statement, setStatement] = useState<LedgerLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const token = await getToken();
      setAuthToken(token);

      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;

      // Parallel fetch party info and statement
      const [partyRes, stmtRes] = await Promise.all([
        api.get(`/customers/${id}?business_id=${bId}`),
        api.get(`/ledger/party/${id}?business_id=${bId}`)
      ]);

      setPartyName(partyRes.data.name || 'Unknown Party');
      setStatement(stmtRes.data.statement || []);
      setError(null);
    } catch (err: any) {
      console.log('Ledger detail fetch error:', err);
      setError('Failed to fetch ledger statement.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.back();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
  );

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const parseVal = (str: string) => Number(str) || 0;

  // Calculation totals
  const totalBilled = statement.reduce((sum, line) => sum + parseVal(line.debit), 0);
  const amountPaid = statement.reduce((sum, line) => sum + parseVal(line.credit), 0);
  
  // Outstanding is the running balance of the latest entry (chronologically last)
  const latestLine = statement[statement.length - 1];
  const outstandingBalance = latestLine ? parseVal(latestLine.running_balance) : 0;

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    const dateObj = new Date(dateString);
    return isNaN(dateObj.getTime()) ? dateString : dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{partyName}</Text>
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
            <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 13 }}>Loading statement...</Text>
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={48} color="#cbd5e1" />
            <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 12 }}>{error}</Text>
          </View>
        ) : statement.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
            <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 12 }}>No transactions found.</Text>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {/* KPI grid */}
            <View style={styles.statsStrip}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Billed</Text>
                <Text style={[styles.statValue, { color: Colors.text }]}>{fmt(totalBilled)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Amount Paid</Text>
                <Text style={[styles.statValue, { color: Colors.success }]}>{fmt(amountPaid)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Outstanding</Text>
                <Text style={[styles.statValue, { color: outstandingBalance > 0 ? Colors.danger : Colors.success }]}>
                  {fmt(outstandingBalance)}
                </Text>
              </View>
            </View>

            {/* Statement Ledger List */}
            <View style={styles.detailCard}>
              <Text style={styles.cardHeaderTitle}>Statement ledger</Text>
              
              {statement.map((line, idx) => {
                const debitVal = parseVal(line.debit);
                const creditVal = parseVal(line.credit);
                
                return (
                  <View key={idx} style={styles.stmtRow}>
                    <View style={styles.rowTop}>
                      <Text style={styles.stmtDate}>{formatDate(line.transaction_date)}</Text>
                      <Text style={styles.stmtNarration} numberOfLines={2}>{line.narration}</Text>
                      
                      {debitVal > 0 ? (
                        <Text style={[styles.amount, { color: Colors.danger }]}>
                          -{fmt(debitVal)}
                        </Text>
                      ) : creditVal > 0 ? (
                        <Text style={[styles.amount, { color: Colors.success }]}>
                          +{fmt(creditVal)}
                        </Text>
                      ) : (
                        <Text style={styles.amount}>—</Text>
                      )}
                    </View>
                    <View style={styles.rowBot}>
                      <Text style={styles.runningBalLabel}>Running Balance:</Text>
                      <Text style={styles.runningBalVal}>
                        {fmt(parseVal(line.running_balance))} ({line.balance_type})
                      </Text>
                    </View>
                  </View>
                );
              })}
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
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text },
  scrollList: { paddingTop: 12, paddingHorizontal: 12, paddingBottom: 80 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 40 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', marginVertical: 40 },
  statsStrip: { flexDirection: 'row', gap: 6 },
  statCard: { flex: 1, backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 8, alignItems: 'center' },
  statLabel: { fontSize: 9, color: Colors.textSecondary, fontWeight: '500', marginBottom: 4 },
  statValue: { fontSize: 12, fontWeight: '700' },
  detailCard: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, gap: 12 },
  cardHeaderTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  stmtRow: { borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingVertical: 10, gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  stmtDate: { fontSize: 10, color: Colors.textMuted, width: 34, marginTop: 2, fontWeight: '600' },
  stmtNarration: { flex: 1, fontSize: 12.5, color: Colors.text, lineHeight: 17 },
  amount: { fontSize: 12.5, fontWeight: '700', textAlign: 'right', width: 80 },
  rowBot: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  runningBalLabel: { fontSize: 9.5, color: Colors.textMuted },
  runningBalVal: { fontSize: 10.5, fontWeight: '600', color: Colors.textSecondary }
});
