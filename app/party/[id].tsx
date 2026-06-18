import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api } from '../../services/api';

export default function PartyDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [party, setParty] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const bizRes = await api.get('/businesses/me');
        const bId = bizRes.data.id;
        const [partyRes, invRes] = await Promise.allSettled([
          api.get(`/customers/${id}?business_id=${bId}`),
          api.get(`/invoices/?business_id=${bId}&limit=20&sort=desc`),
        ]);
        if (partyRes.status === 'fulfilled') setParty(partyRes.value.data);
        if (invRes.status === 'fulfilled') {
          const invData = invRes.value.data;
          const allInvoices = Array.isArray(invData) ? invData : Array.isArray(invData?.invoices) ? invData.invoices : [];
          setInvoices(allInvoices.filter((inv: any) => String(inv.customer_id) === String(id) || String(inv.customer?.id) === String(id)));
        }
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
  if (!party) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Party not found</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle} numberOfLines={1}>{party.name}</Text>
        <TouchableOpacity style={styles.newInvBtn} onPress={() => router.push({ pathname: '/invoice/create', params: { customer_id: String(id) } })}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.newInvBtnText}>New Invoice</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(party.name)}</Text>
          </View>
          <Text style={styles.partyName}>{party.name}</Text>
          {(() => {
            const pt = String(party.party_type || 'customer').toLowerCase();
            const label = pt === 'supplier' ? 'Supplier' : pt === 'both' ? 'Both' : 'Customer';
            const isSupplier = pt === 'supplier';
            const isBoth = pt === 'both';
            return (
              <View style={[styles.typeBadge, isSupplier && styles.typeBadgeSupplier, isBoth && styles.typeBadgeBoth]}>
                <Text style={[styles.typeText, isSupplier && styles.typeTextSupplier, isBoth && styles.typeTextBoth]}>
                  {label}
                </Text>
              </View>
            );
          })()}
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
              <Text style={styles.detailLabel} textBreakStrategy="simple">{item.label}</Text>
              <Text style={styles.detailValue} textBreakStrategy="simple">{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Outstanding — Invoiced vs Paid */}
        {(() => {
          const totalInvoiced = invoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
          const totalPaid = invoices.reduce((s, i) => s + (Number(i.amount_paid ?? (i.payment_status === 'PAID' ? i.total_amount : 0)) || 0), 0);
          const outstanding = totalInvoiced - totalPaid;
          return (
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Outstanding Balance</Text>
              <Text style={[styles.balanceValue, outstanding > 0 ? styles.receivable : styles.receivableZero]}>
                {fmt(Math.abs(outstanding))}
              </Text>
              <View style={styles.balanceRow}>
                <View style={styles.balanceCol}>
                  <Text style={styles.balanceSubLabel}>Total Invoiced</Text>
                  <Text style={styles.balanceSubVal}>{fmt(totalInvoiced)}</Text>
                </View>
                <View style={styles.balanceDivider} />
                <View style={styles.balanceCol}>
                  <Text style={styles.balanceSubLabel}>Total Paid</Text>
                  <Text style={[styles.balanceSubVal, { color: Colors.success }]}>{fmt(totalPaid)}</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Recent Invoices */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Bills</Text>
          {invoices.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No bills yet</Text>
            </View>
          ) : invoices.map(inv => {
            const ps = (inv.payment_status || inv.status || 'UNPAID').toUpperCase();
            const isPaid = ps === 'PAID';
            const isPartial = ps === 'PARTIAL';
            return (
              <TouchableOpacity key={inv.id} style={styles.invCard} onPress={() => router.push(`/invoice/${inv.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invNum}>{inv.invoice_number}</Text>
                  <Text style={styles.invDate}>{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN') : ''}</Text>
                </View>
                <View style={styles.invRight}>
                  <Text style={styles.invAmount}>{fmt(inv.total_amount)}</Text>
                  <View style={[styles.badge, isPaid ? styles.paidBadge : isPartial ? styles.partialBadge : styles.unpaidBadge]}>
                    <Text style={[styles.badgeText, isPaid ? styles.paidText : isPartial ? styles.partialText : styles.unpaidText]}>{ps}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
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
  typeBadgeBoth: { backgroundColor: '#f5f3ff' },
  typeText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  typeTextSupplier: { color: Colors.info },
  typeTextBoth: { color: '#7c3aed' },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  detailLabel: { fontSize: 13, color: Colors.textSecondary, width: 60, flexShrink: 1 },
  detailValue: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: '500' },
  outstandingCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center' },
  outstandingLabel: { fontSize: 12, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  outstandingValue: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  outstandingType: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  balanceCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center' },
  balanceLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  balanceValue: { fontSize: 28, fontWeight: '800', letterSpacing: -1, marginBottom: 14 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  balanceCol: { flex: 1, alignItems: 'center' },
  balanceDivider: { width: 0.5, alignSelf: 'stretch', backgroundColor: Colors.border, marginHorizontal: 8 },
  balanceSubLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  balanceSubVal: { fontSize: 14, fontWeight: '700', color: Colors.text },
  receivableZero: { color: Colors.success },
  partialBadge: { backgroundColor: '#EFF6FF' },
  partialText: { color: '#2563EB' },
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
