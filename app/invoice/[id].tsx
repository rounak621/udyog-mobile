import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, Share
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams();
  const { getToken } = useAuth();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const res = await api.get(`/invoices/${id}`);
        setInvoice(res.data);
      } catch (err) {
        console.log('Invoice detail error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Invoice ${invoice?.invoice_number} for ${fmt(invoice?.total_amount)} from Udyog.\nView at: https://app.udyogbook.in/invoices/${id}`,
        title: `Invoice ${invoice?.invoice_number}`,
      });
    } catch {}
  };

  const handleMarkPaid = async () => {
    Alert.alert('Mark as Paid', 'Mark this invoice as paid?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Paid', onPress: async () => {
          try {
            const token = await getToken();
            setAuthToken(token);
            await api.patch(`/invoices/${id}`, { status: 'PAID' });
            setInvoice((prev: any) => ({ ...prev, status: 'PAID' }));
          } catch { Alert.alert('Error', 'Failed to update status'); }
        }
      }
    ]);
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>;
  if (!invoice) return <View style={styles.loader}><Text style={{ color: Colors.textSecondary }}>Invoice not found</Text></View>;

  const isPaid = invoice.status === 'PAID';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Invoice</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.invoiceNum}>{invoice.invoice_number}</Text>
              <Text style={styles.invoiceDate}>{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}</Text>
            </View>
            <View style={[styles.badge, isPaid ? styles.paidBadge : styles.unpaidBadge]}>
              <Text style={[styles.badgeText, isPaid ? styles.paidText : styles.unpaidText]}>{invoice.status || 'UNPAID'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Bill To</Text>
          <Text style={styles.partyName}>{invoice.party_name || invoice.customer_name || 'Unknown Party'}</Text>
          {invoice.party_gstin && <Text style={styles.partyGst}>GSTIN: {invoice.party_gstin}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Items</Text>
          {(invoice.items || invoice.invoice_items || []).map((item: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.item_name || item.name}</Text>
                <Text style={styles.itemSub}>{item.quantity} {item.unit || 'pcs'} × {fmt(item.rate || item.unit_price)} · GST {item.gst_rate || 0}%</Text>
              </View>
              <Text style={styles.itemAmount}>{fmt(item.amount || item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalVal}>{fmt(invoice.subtotal || invoice.total_amount)}</Text></View>
          {invoice.cgst_amount > 0 && <View style={styles.totalRow}><Text style={styles.totalLabel}>CGST</Text><Text style={styles.totalVal}>{fmt(invoice.cgst_amount)}</Text></View>}
          {invoice.sgst_amount > 0 && <View style={styles.totalRow}><Text style={styles.totalLabel}>SGST</Text><Text style={styles.totalVal}>{fmt(invoice.sgst_amount)}</Text></View>}
          {invoice.igst_amount > 0 && <View style={styles.totalRow}><Text style={styles.totalLabel}>IGST</Text><Text style={styles.totalVal}>{fmt(invoice.igst_amount)}</Text></View>}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontSize: 15, fontWeight: '600', color: Colors.text }]}>Total</Text>
            <Text style={[styles.totalVal, { fontSize: 16, fontWeight: '700', color: Colors.primary }]}>{fmt(invoice.total_amount)}</Text>
          </View>
        </View>

        {!isPaid && (
          <TouchableOpacity style={styles.paidBtn} onPress={handleMarkPaid}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.paidBtnText}>Mark as Paid</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { padding: 4, marginRight: 8 },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  shareBtn: { padding: 4 },
  content: { padding: 12, gap: 10, paddingBottom: 40 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceNum: { fontSize: 17, fontWeight: '600', color: Colors.text },
  invoiceDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  divider: { height: 0.5, backgroundColor: Colors.border, marginVertical: 12 },
  sectionLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  partyName: { fontSize: 15, fontWeight: '500', color: Colors.text },
  partyGst: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  itemName: { fontSize: 13, fontWeight: '500', color: Colors.text },
  itemSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  itemAmount: { fontSize: 13, fontWeight: '500', color: Colors.text },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 13, color: Colors.textSecondary },
  totalVal: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  paidBadge: { backgroundColor: '#F0FDF4' },
  unpaidBadge: { backgroundColor: '#FFF7ED' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  paidText: { color: Colors.success },
  unpaidText: { color: '#EA580C' },
  paidBtn: { backgroundColor: Colors.success, borderRadius: Radius.sm, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  paidBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
