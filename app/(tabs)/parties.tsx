import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
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
  const insets = useSafeAreaInsets();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'customer' | 'supplier'>('all');

  const loadParties = async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      const res = await api.get(`/customers/?business_id=${bId}`);
      const partyData = res.data;
      setParties(Array.isArray(partyData) ? partyData : Array.isArray(partyData?.customers) ? partyData.customers : Array.isArray(partyData?.items) ? partyData.items : []);
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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.title}>Parties</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/party/create')}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 14 }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, height: 44 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}>
        {['All', 'Customers', 'Suppliers'].map(f => {
          const value = f === 'All' ? 'all' : f === 'Customers' ? 'customer' : 'supplier';
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(value)}
              style={[styles.chip, filter === value && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === value && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[styles.list, filtered.length === 0 && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadParties(); }} colors={[Colors.primary]} />}
      >
          {filtered.length === 0 ? (
            /* v1.0.1 */
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="people-outline" size={48} color="#cbd5e1" />
              <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '500', marginTop: 12 }}>No parties</Text>
              <TouchableOpacity style={{ backgroundColor: '#F97316', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10, marginTop: 16 }} onPress={() => router.push('/party/create')}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Add First Party</Text>
              </TouchableOpacity>
            </View>
          ) : filtered.map(party => {
            const pt = String(party.party_type || 'customer').toLowerCase();
            const typeLabel = pt === 'supplier' ? 'Supplier' : pt === 'both' ? 'Both' : 'Customer';
            const isSupplier = pt === 'supplier';
            const isBoth = pt === 'both';
            return (
              <TouchableOpacity key={party.id} style={styles.card} onPress={() => router.push(`/party/${party.id}`)}>
                <View style={[styles.avatar, isSupplier && styles.avatarSupplier, isBoth && styles.avatarBoth]}>
                  <Text style={[styles.avatarText, isSupplier && styles.avatarTextSupplier, isBoth && styles.avatarTextBoth]}>{getInitials(party.name)}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{party.name}</Text>
                    <View style={[styles.typeBadge, isSupplier && styles.typeBadgeSupplier, isBoth && styles.typeBadgeBoth]}>
                      <Text style={[styles.typeBadgeText, isSupplier && styles.typeBadgeTextSupplier, isBoth && styles.typeBadgeTextBoth]}>
                        {typeLabel}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardSub} numberOfLines={1} textBreakStrategy="simple">
                    {party.phone || party.gstin || '—'}
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
            );
          })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, marginHorizontal: 12, marginTop: 12, marginBottom: 8, borderRadius: Radius.sm, paddingHorizontal: 12, height: 44, borderWidth: 0.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text, height: 20 },
  chip: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  chipText: { fontSize: 13, color: '#64748b', fontWeight: '500', lineHeight: 16 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 4, paddingHorizontal: 12, paddingBottom: 80, gap: 8 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  avatarSupplier: { backgroundColor: '#eff6ff' },
  avatarBoth: { backgroundColor: '#f5f3ff' },
  avatarText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  avatarTextSupplier: { color: Colors.info },
  avatarTextBoth: { color: '#7c3aed' },
  typeBadge: { backgroundColor: '#fff7ed', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeSupplier: { backgroundColor: '#eff6ff' },
  typeBadgeBoth: { backgroundColor: '#f5f3ff' },
  typeBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.primary, letterSpacing: 0.4, textTransform: 'uppercase' },
  typeBadgeTextSupplier: { color: Colors.info },
  typeBadgeTextBoth: { color: '#7c3aed' },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  cardSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2, flexShrink: 1 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  outstanding: { fontSize: 12, fontWeight: '600' },
  receivable: { color: Colors.success },
  payable: { color: Colors.danger },
});
