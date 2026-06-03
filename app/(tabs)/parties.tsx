import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

interface Party {
  id: string;
  name: string;
  phone?: string;
  gstin?: string;
  party_type: string;
  outstanding_amount?: number;
}

export default function PartiesScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'customer' | 'supplier'>('all');

  const loadParties = async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await api.get('/customers?limit=100');
      setParties(res.data.customers || res.data || []);
    } catch (err) {
      console.log('Parties error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadParties(); }, []);

  const filtered = parties.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search) || p.gstin?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || p.party_type === filter;
    return matchSearch && matchFilter;
  });

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  const getInitials = (name: string) => name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.topbar}>
        <Text style={styles.title}>Parties</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/party/create')}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, phone, GSTIN..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={Colors.textMuted} /></TouchableOpacity> : null}
      </View>

      <View style={styles.filterRow}>
        {(['all', 'customer', 'supplier'] as const).map(f => (
          <TouchableOpacity key={f} style={[styles.filterChip, filter === f && styles.filterChipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f === 'all' ? 'All' : f === 'customer' ? 'Customers' : 'Suppliers'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadParties(); }} colors={[Colors.primary]} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No parties found</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/party/create')}>
                <Text style={styles.emptyBtnText}>Add First Party</Text>
              </TouchableOpacity>
            </View>
          ) : filtered.map(party => (
            <TouchableOpacity key={party.id} style={styles.card} onPress={() => router.push(`/party/${party.id}`)}>
              <View style={[styles.avatar, party.party_type === 'supplier' && styles.avatarSupplier]}>
                <Text style={styles.avatarText}>{getInitials(party.name)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{party.name}</Text>
                <Text style={styles.cardSub}>
                  {party.phone || party.gstin || (party.party_type === 'supplier' ? 'Supplier' : 'Customer')}
                </Text>
              </View>
              <View style={styles.cardRight}>
                {party.outstanding_amount ? (
                  <Text style={[styles.outstanding, party.outstanding_amount > 0 ? styles.receivable : styles.payable]}>
                    {fmt(Math.abs(party.outstanding_amount))}
                  </Text>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: '600', color: Colors.text },
  addBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, margin: 12, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, color: Colors.textSecondary },
  filterTextActive: { color: '#fff', fontWeight: '500' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, paddingBottom: 80, gap: 8 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  avatarSupplier: { backgroundColor: '#eff6ff' },
  avatarText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  cardSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  outstanding: { fontSize: 12, fontWeight: '600' },
  receivable: { color: Colors.success },
  payable: { color: Colors.danger },
});
