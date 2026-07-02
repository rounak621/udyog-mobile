import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

interface PurchaseBillItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  gst_percent: number;
  amount: number;
  tax_amount: number;
}

interface PurchaseBill {
  id: string;
  supplier_invoice_number: string;
  supplier: {
    id: string;
    name: string;
    gstin?: string | null;
    state?: string | null;
  };
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  round_off: number;
  payment_status: string;
  bill_date: string;
  items: PurchaseBillItem[];
}

export default function PurchaseBillDetailScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bill, setBill] = useState<PurchaseBill | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBill = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const bizRes = await api.get('/businesses/me');
        const bId = bizRes.data.id;
        const res = await api.get(`/purchase-bills/${id}?business_id=${bId}`);
        setBill(res.data);
      } catch (err: any) {
        Alert.alert('Error', 'Failed to load purchase bill details');
        router.back();
      } finally {
        setLoading(false);
      }
    };
    loadBill();
  }, [id]);

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!bill) return null;

  const ps = (bill.payment_status || 'UNPAID').toUpperCase();
  const isPaid = ps === 'PAID';
  const isPartial = ps === 'PARTIAL';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Bill Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Header */}
        <View style={styles.headerCard}>
          <Text style={styles.supplierName}>{bill.supplier?.name || 'Unknown Supplier'}</Text>
          {bill.supplier?.gstin && <Text style={styles.gstinText}>GSTIN: {bill.supplier.gstin}</Text>}
          <View style={styles.statusRow}>
            <View style={[
              styles.badge,
              isPaid ? styles.paidBadge :
              isPartial ? styles.partialBadge :
              styles.unpaidBadge
            ]}>
              <Text style={[
                styles.badgeText,
                isPaid ? styles.paidText :
                isPartial ? styles.partialText :
                styles.unpaidText
              ]}>{ps}</Text>
            </View>
            <Text style={styles.dateText}>
              {new Date(bill.bill_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Invoice Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Invoice Number</Text>
            <Text style={styles.infoValue}>{bill.supplier_invoice_number || 'N/A'}</Text>
          </View>
          {bill.supplier?.state && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Supplier State</Text>
              <Text style={styles.infoValue}>{bill.supplier.state}</Text>
            </View>
          )}
        </View>

        {/* Bill Items */}
        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.itemsCard}>
          {bill.items.map((item, index) => (
            <View key={item.id || index} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemDesc}>{item.description}</Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} {item.gst_percent}% GST · {fmt(item.unit_price)} each
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.itemAmt}>{fmt(item.amount)}</Text>
                {item.tax_amount > 0 && (
                  <Text style={styles.itemTax}>+ {fmt(item.tax_amount)} tax</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{fmt(bill.subtotal)}</Text>
          </View>
          
          {bill.cgst_amount ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>CGST</Text>
              <Text style={styles.summaryValue}>{fmt(bill.cgst_amount)}</Text>
            </View>
          ) : null}

          {bill.sgst_amount ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>SGST</Text>
              <Text style={styles.summaryValue}>{fmt(bill.sgst_amount)}</Text>
            </View>
          ) : null}

          {bill.igst_amount ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>IGST</Text>
              <Text style={styles.summaryValue}>{fmt(bill.igst_amount)}</Text>
            </View>
          ) : null}

          {bill.round_off !== 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Round Off</Text>
              <Text style={styles.summaryValue}>{fmt(bill.round_off)}</Text>
            </View>
          )}

          <View style={[styles.summaryRow, { borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 10, marginTop: 4 }]}>
            <Text style={[styles.summaryLabel, { fontWeight: '700', color: Colors.text }]}>Total Amount</Text>
            <Text style={[styles.summaryValue, { fontWeight: '800', color: Colors.primary, fontSize: 16 }]}>{fmt(bill.total_amount)}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  headerCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border, gap: 4 },
  supplierName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  gstinText: { fontSize: 12, color: Colors.textMuted },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  dateText: { fontSize: 12, color: Colors.textSecondary },
  infoCard: { backgroundColor: Colors.card, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 0.5, borderColor: Colors.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 13, color: Colors.textSecondary },
  infoValue: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginTop: 8, marginLeft: 4 },
  itemsCard: { backgroundColor: Colors.card, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 0.5, borderColor: Colors.border },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  itemDesc: { fontSize: 13, fontWeight: '500', color: Colors.text },
  itemMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  itemAmt: { fontSize: 13, fontWeight: '600', color: Colors.text },
  itemTax: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  summaryCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary },
  summaryValue: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  badge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  paidBadge: { backgroundColor: '#F0FDF4' },
  unpaidBadge: { backgroundColor: '#FFF7ED' },
  partialBadge: { backgroundColor: '#EFF6FF' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  paidText: { color: Colors.success },
  unpaidText: { color: '#EA580C' },
  partialText: { color: '#2563EB' },
});
