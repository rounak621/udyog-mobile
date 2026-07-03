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
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const bizRes = await api.get('/businesses/me');
        const bId = bizRes.data.id;
        
        const partyRes = await api.get(`/customers/${id}?business_id=${bId}`);
        const partyData = partyRes.data;
        setParty(partyData);

        const pt = String(partyData?.party_type || 'customer').toLowerCase();
        const isSupplier = pt === 'supplier' || pt === 'both';

        const [invRes, pbRes] = await Promise.allSettled([
          api.get(`/invoices/?business_id=${bId}&customer_id=${id}&limit=1000&skip=0`),
          isSupplier ? api.get(`/purchase-bills/?business_id=${bId}&supplier_id=${id}`) : Promise.resolve({ data: [] }),
        ]);

        let invoiceList: any[] = [];
        if (invRes.status === 'fulfilled') {
          const invData = invRes.value.data;
          invoiceList = Array.isArray(invData) ? invData : Array.isArray(invData?.items) ? invData.items : Array.isArray(invData?.invoices) ? invData.invoices : [];
        }

        let pbList: any[] = [];
        if (pbRes.status === 'fulfilled') {
          const pbData = (pbRes.value as any)?.data;
          pbList = Array.isArray(pbData) ? pbData : Array.isArray(pbData?.items) ? pbData.items : Array.isArray(pbData?.purchase_bills) ? pbData.purchase_bills : [];
        }

        const combined = [
          ...invoiceList.map((inv: any) => ({
            id: inv.id,
            date: inv.invoice_date || inv.created_at,
            billNumber: inv.invoice_number || '—',
            amount: Number(inv.total_amount || 0),
            paidAmount: Number(inv.paid_amount || inv.amount_paid || 0),
            type: 'INVOICE',
            status: Math.round(Number(inv.paid_amount || inv.amount_paid || 0)) >= Math.round(Number(inv.total_amount || 0)) ? 'PAID' : Number(inv.paid_amount || inv.amount_paid || 0) > 0 ? 'PARTIAL' : 'UNPAID',
          })),
          ...pbList.map((pb: any) => ({
            id: pb.id,
            date: pb.bill_date || pb.created_at,
            billNumber: pb.supplier_invoice_number || '—',
            amount: Number(pb.total_amount || 0),
            paidAmount: Number(pb.paid_amount || pb.amount_paid || 0),
            type: 'PURCHASE',
            status: pb.payment_status || 'UNPAID',
          }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setBills(combined);
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
        <TouchableOpacity
          style={styles.newInvBtn}
          onPress={() => {
            const pt = String(party?.party_type || 'customer').toLowerCase();
            if (pt === 'supplier') {
              router.push('/purchase-bills/create');
            } else {
              router.push({ pathname: '/invoice/create', params: { customer_id: String(id) } });
            }
          }}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.newInvBtnText}>
            {String(party?.party_type || 'customer').toLowerCase() === 'supplier' ? 'New Bill' : 'New Invoice'}
          </Text>
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
          const totalSalesInvoiced = bills.filter(b => b.type === 'INVOICE').reduce((s, b) => s + b.amount, 0);
          const totalSalesPaid = bills.filter(b => b.type === 'INVOICE').reduce((s, b) => s + b.paidAmount, 0);
          
          const totalPurchaseInvoiced = bills.filter(b => b.type === 'PURCHASE').reduce((s, b) => s + b.amount, 0);
          const totalPurchasePaid = bills.filter(b => b.type === 'PURCHASE').reduce((s, b) => s + b.paidAmount, 0);
          
          const salesOutstanding = totalSalesInvoiced - totalSalesPaid;
          const purchaseOutstanding = totalPurchaseInvoiced - totalPurchasePaid;
          
          const netOutstanding = salesOutstanding - purchaseOutstanding;
          
          const pt = String(party.party_type || 'customer').toLowerCase();
          const isSupplierOnly = pt === 'supplier';
          const isBoth = pt === 'both';
          
          return (
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>
                {isSupplierOnly ? 'Net Payable Balance' : isBoth ? 'Net Outstanding Balance' : 'Outstanding Balance'}
              </Text>
              <Text style={[
                styles.balanceValue, 
                netOutstanding > 0 ? styles.receivable : 
                netOutstanding < 0 ? styles.payable : 
                styles.receivableZero
              ]}>
                {fmt(Math.abs(netOutstanding))}
              </Text>
              
              <View style={styles.balanceRow}>
                {isSupplierOnly ? (
                  <>
                    <View style={styles.balanceCol}>
                      <Text style={styles.balanceSubLabel}>Total Purchase</Text>
                      <Text style={styles.balanceSubVal}>{fmt(totalPurchaseInvoiced)}</Text>
                    </View>
                    <View style={styles.balanceDivider} />
                    <View style={styles.balanceCol}>
                      <Text style={styles.balanceSubLabel}>Total Paid</Text>
                      <Text style={[styles.balanceSubVal, { color: Colors.success }]}>{fmt(totalPurchasePaid)}</Text>
                    </View>
                  </>
                ) : isBoth ? (
                  <>
                    <View style={styles.balanceCol}>
                      <Text style={styles.balanceSubLabel}>To Receive (Sales)</Text>
                      <Text style={[styles.balanceSubVal, { color: Colors.success }]}>{fmt(salesOutstanding)}</Text>
                    </View>
                    <View style={styles.balanceDivider} />
                    <View style={styles.balanceCol}>
                      <Text style={styles.balanceSubLabel}>To Pay (Purchases)</Text>
                      <Text style={[styles.balanceSubVal, { color: Colors.danger }]}>{fmt(purchaseOutstanding)}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.balanceCol}>
                      <Text style={styles.balanceSubLabel}>Total Invoiced</Text>
                      <Text style={styles.balanceSubVal}>{fmt(totalSalesInvoiced)}</Text>
                    </View>
                    <View style={styles.balanceDivider} />
                    <View style={styles.balanceCol}>
                      <Text style={styles.balanceSubLabel}>Total Paid</Text>
                      <Text style={[styles.balanceSubVal, { color: Colors.success }]}>{fmt(totalSalesPaid)}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          );
        })()}

        {/* Recent Invoices */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Bills</Text>
          {bills.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No bills yet</Text>
            </View>
          ) : bills.map(bill => {
            const ps = (bill.status || 'UNPAID').toUpperCase();
            const isPaid = ps === 'PAID';
            const isPartial = ps === 'PARTIAL';
            const isInvoice = bill.type === 'INVOICE';
            
            return (
              <TouchableOpacity 
                key={`${bill.type}_${bill.id}`} 
                style={styles.invCard} 
                onPress={() => router.push(isInvoice ? `/invoice/${bill.id}` : `/purchase-bills/${bill.id}`)}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.invNum}>{bill.billNumber}</Text>
                    <View style={{
                      paddingHorizontal: 6,
                      paddingVertical: 1.5,
                      borderRadius: 10,
                      backgroundColor: isInvoice ? '#EFF6FF' : '#FAF5FF',
                    }}>
                      <Text style={{
                        fontSize: 9,
                        fontWeight: '700',
                        color: isInvoice ? '#1D4ED8' : '#6B21A8',
                      }}>
                        {isInvoice ? 'Sale' : 'Purchase'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.invDate}>{bill.date ? new Date(bill.date).toLocaleDateString('en-IN') : ''}</Text>
                </View>
                <View style={styles.invRight}>
                  <Text style={styles.invAmount}>{fmt(bill.amount)}</Text>
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
