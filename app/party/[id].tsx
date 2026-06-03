import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

export default function PartyDetailScreen() {
  const { id } = useLocalSearchParams();
  const { getToken } = useAuth();
  const router = useRouter();
  const [party, setParty] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const [partyRes, invRes] = await Promise.allSettled([
          api.get(`/customers/${id}`),
          api.get(`/invoices?customer_id=${id}&limit=10`),
        ]);
        if (partyRes.status === 'fulfilled') setParty(partyRes.value.data);
        if (invRes.status === 'fulfilled') setInvoices(invRes.value.data.invoices || invRes.value.data || []);
      } catch (err) {
        console.log('Party detail error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');
  const getInitials = (name: string) => name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  if (loading) return <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>;
  if (!party) return <View style={styles.loader}><Text style={{ color: Colors.textSecondary }}>Party not found</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle} numberOfLines={1}>{party.name}</Text>
        <TouchableOpacity style={styles.newInvBtn} onPress={() => router.push({ pathname: '/invoice/create', params: { party_id: id } })}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.newInvBtnText}>Invoice</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(party.name)}</Text>
          </View>
          <Text style={styles.partyName}>{party.name}</Text>
          <View style={[styles.typeBadge, party.party_type === 'supplier' && styles.typeBadgeSupplier]}>
            <Text style={[styles.typeText, party.party_type === 'supplier' && styles.typeTextSupplier]}>
              {party.party_type === 'supplier' ? 'Supplier' : 'Customer'}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          {[
            { icon: 'call-outline', label: 'Phone', value: party.phone || '—' },
            { icon: 'mail-outline', label: 'Email', value: party.email || '—' },
            { icon: 'card-outline', label: 'GSTIN', value: party.gstin || '—' },
            { icon: 'location-outline', label: 'State', value: party.state || '—' },
          ].map(item => (
            <View key={item.label} style={styles.detailRow}>
              <Ionicons name={item.icon as any} size={16} color={Colors.textMuted} />
              <Text style={styles.detailLabel}>{item.label}</Text>
              <Text style={styles.detailValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Outstanding */}
        {party.outstanding_amount !== undefined && (
          <View style={styles.outstandingCard}>
            <Text style={styles.outstandingLabel}>Outstanding Amount</Text>
            <Text style={[styles.outstandingValue, party.outstanding_amount >= 0 ? styles.receivable : styles.payable]}>
              {fmt(Math.abs(party.outstanding_amount))}
            </Text>
            <Text style={styles.outstandingType}>
              {party.outstanding_amount >= 0 ? 'Receivable (they owe you)' : 'Payable (you owe them)'}
            </Text>
          </View>
        )}

        {/* Recent Invoices */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Bills</Text>
          {invoices.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No bills yet</Text>
            </View>
          ) : invoices.map(inv => (
            <TouchableOpacity key={inv.id} style={styles.invCard} onPress={() => router.push(`/invoice/${inv.id}`)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.invNum}>{inv.invoice_number}</Text>
                <Text style={styles.invDate}>{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN') : ''}</Text>
              </View>
              <View style={styles.invRight}>
                <Text style={styles.invAmount}>{fmt(inv.total_amount)}</Text>
                <View style={[styles.badge, inv.status === 'PAID' ? styles.paidBadge : styles.unpaidBadge]}>
                  <Text style={[styles.badgeText, inv.status === 'PAID' ? styles.paidText : styles.unpaidText]}>{inv.status || 'UNPAID'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  newInvBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  newInvBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  profileCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 24, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 22, fontWeight: '700', color: Colors.primary },
  partyName: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  typeBadge: { backgroundColor: '#fff7ed', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  typeBadgeSupplier: { backgroundColor: '#eff6ff' },
  typeText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  typeTextSupplier: { color: Colors.info },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  detailLabel: { fontSize: 13, color: Colors.textSecondary, width: 60 },
  detailValue: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: '500' },
  outstandingCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center' },
  outstandingLabel: { fontSize: 12, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  outstandingValue: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  outstandingType: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  receivable: { color: Colors.success },
  payable: { color: Colors.danger },
  section: {},
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 10 },
  emptyCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 24, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border },
  emptyText: { fontSize: 13, color: Colors.textSecondary },
  invCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  invNum: { fontSize: 13, fontWeight: '600', color: Colors.text },
  invDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  invRight: { alignItems: 'flex-end', gap: 4 },
  invAmount: { fontSize: 13, fontWeight: '600', color: Colors.text },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  paidBadge: { backgroundColor: '#f0fdf4' },
  unpaidBadge: { backgroundColor: '#fff7ed' },
  badgeText: { fontSize: 9, fontWeight: '600' },
  paidText: { color: Colors.success },
  unpaidText: { color: '#ea580c' },
});
