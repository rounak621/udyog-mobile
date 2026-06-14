import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

const FILTERS = ['All', 'Unpaid', 'Paid', 'Draft'];

interface Invoice {
  id: string;
  invoice_number: string;
  party_name: string;
  total_amount: number;
  status: string;
  invoice_date: string;
}

export default function BillsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [businessId, setBusinessId] = useState<string>('');

  const loadInvoices = async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      setBusinessId(bId);
      const res = await api.get(`/invoices?limit=50&sort=desc&business_id=${bId}`);
      setInvoices(res.data.invoices || res.data || []);
    } catch (err) {
      console.log('Bills load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadInvoices(); }, []);

  const filtered = invoices.filter(inv => {
    const matchSearch = !search || inv.party_name?.toLowerCase().includes(search.toLowerCase()) || inv.invoice_number?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || inv.status?.toUpperCase() === filter.toUpperCase();
    return matchSearch && matchFilter;
  });

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Bills</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/invoice/create')}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by party or invoice number..."
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {['All', 'Unpaid', 'Paid', 'Draft'].map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, filter === f && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadInvoices(); }} colors={[Colors.primary]} />}
        >
          {filtered.length === 0 ? (
            /* v1.0.1 */
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
              <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '500', marginTop: 12 }}>No invoices</Text>
            </View>
          ) : filtered.map(inv => (
            <TouchableOpacity key={inv.id} style={styles.card} onPress={() => router.push(`/invoice/${inv.id}`)}>
              <View style={styles.cardIcon}>
                <Ionicons name="business-outline" size={18} color={Colors.textSecondary} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{inv.party_name || 'Unknown Party'}</Text>
                <Text style={styles.cardSub}>{inv.invoice_number} · {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardAmount}>{fmt(inv.total_amount)}</Text>
                <View style={[styles.badge, inv.status === 'PAID' ? styles.paidBadge : inv.status === 'DRAFT' ? styles.draftBadge : styles.unpaidBadge]}>
                  <Text style={[styles.badgeText, inv.status === 'PAID' ? styles.paidText : inv.status === 'DRAFT' ? styles.draftText : styles.unpaidText]}>{inv.status || 'UNPAID'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, margin: 12, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text },
  chip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  chipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 1, padding: 12, paddingBottom: 80, gap: 8 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 13, fontWeight: '500', color: Colors.text },
  cardSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardAmount: { fontSize: 13, fontWeight: '600', color: Colors.text },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  paidBadge: { backgroundColor: '#F0FDF4' },
  unpaidBadge: { backgroundColor: '#FFF7ED' },
  draftBadge: { backgroundColor: '#F8FAFC' },
  badgeText: { fontSize: 9, fontWeight: '600' },
  paidText: { color: Colors.success },
  unpaidText: { color: '#EA580C' },
  draftText: { color: Colors.textSecondary },
});
