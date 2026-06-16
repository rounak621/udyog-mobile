import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, Share, Linking, Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams();
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE'>('CASH');
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  const loadInvoice = async () => {
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

  useEffect(() => {
    loadInvoice();
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

  const handleWhatsAppShare = async () => {
    try {
      const pdfUrl = `https://api.udyogbook.in/api/v1/public/invoice/${invoice.share_token}/pdf`;
      const fileUri = (FileSystem as any).cacheDirectory + `invoice_${invoice.invoice_number?.replace('/', '_')}.pdf`;
      const { uri } = await FileSystem.downloadAsync(pdfUrl, fileUri);
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Invoice ${invoice.invoice_number}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      Alert.alert('Error', 'Could not share PDF');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const pdfUrl = `https://api.udyogbook.in/api/v1/public/invoice/${invoice.share_token}/pdf`;
      const fileName = `invoice_${invoice.invoice_number?.replace('/', '_')}.pdf`;
      const downloadDest = (FileSystem as any).documentDirectory + fileName;
      const { uri } = await FileSystem.downloadAsync(pdfUrl, downloadDest);
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save to Downloads',
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      Alert.alert('Error', 'Could not download PDF');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Invoice',
      `Are you sure you want to delete invoice ${invoice?.invoice_number}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              const token = await getToken();
              setAuthToken(token);
              await api.delete(`/invoices/${id}?business_id=${invoice.business_id}`);
              router.replace('/(tabs)/bills');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.detail || 'Failed to delete invoice');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const openPaymentModal = () => {
    setPaymentMode('CASH');
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async () => {
    try {
      setConfirmingPayment(true);
      const token = await getToken();
      setAuthToken(token);
      await api.post(`/invoices/${id}/mark-paid`, { payment_mode: paymentMode });
      setShowPaymentModal(false);
      await loadInvoice();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to mark as paid');
    } finally {
      setConfirmingPayment(false);
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>;
  if (!invoice) return <View style={styles.loader}><Text style={{ color: Colors.textSecondary }}>Invoice not found</Text></View>;

  const isPaid = invoice.payment_status === 'PAID' || invoice.status === 'PAID';
  const shareUrl = `https://app.udyogbook.in/invoice/${invoice.id}`;

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
        <TouchableOpacity
          onPress={() => Linking.openURL(`https://app.udyogbook.in/invoices/${id}/edit`)}
          style={{ padding: 4, marginRight: 8 }}
        >
          <Ionicons name="pencil-outline" size={20} color="#F97316" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.shareBtn} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator size="small" color={Colors.danger} />
          ) : (
            <Ionicons name="trash-outline" size={22} color={Colors.danger} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.invoiceNum}>{invoice.invoice_number}</Text>
              {invoice.invoice_type === 'SERVICE' && (
                <View style={{ backgroundColor: '#FFF7ED', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4, alignSelf: 'flex-start' }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#C2410C' }}>Service</Text>
                </View>
              )}
              {invoice.invoice_type === 'NONGST' && (
                <View style={{ backgroundColor: '#F1F5F9', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4, alignSelf: 'flex-start' }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#475569' }}>Non-GST</Text>
                </View>
              )}
              <Text style={styles.invoiceDate}>{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}</Text>
            </View>
            <View style={[styles.badge, 
              invoice.payment_status === 'PAID' ? styles.paidBadge : 
              invoice.payment_status === 'PARTIAL' ? styles.partialBadge : 
              styles.unpaidBadge
            ]}>
              <Text style={[styles.badgeText,
                invoice.payment_status === 'PAID' ? styles.paidText :
                invoice.payment_status === 'PARTIAL' ? styles.partialText :
                styles.unpaidText
              ]}>{invoice.payment_status || 'UNPAID'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Bill To</Text>
          <Text style={styles.partyName}>{invoice.party_name || invoice.customer_name || 'Unknown Party'}</Text>
          {invoice.party_gstin && <Text style={styles.partyGst}>GSTIN: {invoice.party_gstin}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Items</Text>
          {(invoice.line_items || invoice.items || []).map((item: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.item_name || item.name}</Text>
                <Text style={styles.itemSub}>{item.quantity} {item.unit || 'pcs'} × {fmt(item.rate || item.unit_price)} · GST {item.gst_rate || 0}%</Text>
              </View>
              <Text style={styles.itemAmount}>{fmt(item.line_total || item.amount || item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.totalRow}><Text style={[styles.totalLabel, { width: 100 }]} numberOfLines={1}>Subtotal</Text><Text style={styles.totalVal}>{fmt(invoice.taxable_amount || invoice.subtotal)}</Text></View>
          {invoice.cgst_amount > 0 && <View style={styles.totalRow}><Text style={[styles.totalLabel, { width: 100 }]} numberOfLines={1}>CGST</Text><Text style={styles.totalVal}>{fmt(invoice.cgst_amount)}</Text></View>}
          {invoice.sgst_amount > 0 && <View style={styles.totalRow}><Text style={[styles.totalLabel, { width: 100 }]} numberOfLines={1}>SGST</Text><Text style={styles.totalVal}>{fmt(invoice.sgst_amount)}</Text></View>}
          {invoice.igst_amount > 0 && <View style={styles.totalRow}><Text style={[styles.totalLabel, { width: 100 }]} numberOfLines={1}>IGST</Text><Text style={styles.totalVal}>{fmt(invoice.igst_amount)}</Text></View>}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontSize: 15, fontWeight: '600', color: Colors.text, width: 100 }]} numberOfLines={1}>Total</Text>
            <Text style={[styles.totalVal, { fontSize: 16, fontWeight: '700', color: Colors.primary }]}>{fmt(invoice.total_amount)}</Text>
          </View>
        </View>

        {invoice.notes && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={{ fontSize: 13, color: Colors.textSecondary, lineHeight: 20 }}>{invoice.notes}</Text>
          </View>
        )}

        {!isPaid && (
          <TouchableOpacity style={styles.paidBtn} onPress={openPaymentModal}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.paidBtnText}>Mark as Paid</Text>
          </TouchableOpacity>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1 }]}
            onPress={() => setShowPdfPreview(true)}
          >
            <Ionicons name="eye-outline" size={18} color="#2563EB" />
            <Text style={[styles.actionBtnText, { color: '#2563EB' }]}>Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1, backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1 }]}
            onPress={handleWhatsAppShare}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
            <Text style={[styles.actionBtnText, { color: '#16A34A' }]}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1, backgroundColor: '#F1F5F9', borderColor: '#CBD5E1', borderWidth: 1 }]}
            onPress={handleDownloadPDF}
          >
            <Ionicons name="download-outline" size={18} color="#475569" />
            <Text style={[styles.actionBtnText, { color: '#475569' }]}>Save PDF</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Payment Modal (bottom sheet) */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.payOverlay}>
          <View style={styles.paySheet}>
            <View style={styles.paySheetHandle} />
            <View style={styles.payHeader}>
              <Text style={styles.payTitle}>Mark as Paid</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <Text style={styles.paySubtitle}>Select payment mode</Text>

            <View style={{ gap: 10, marginBottom: 20 }}>
              {([
                { value: 'CASH', label: 'Cash', icon: 'cash-outline' },
                { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: 'business-outline' },
                { value: 'UPI', label: 'UPI', icon: 'phone-portrait-outline' },
                { value: 'CHEQUE', label: 'Cheque', icon: 'document-text-outline' },
              ] as const).map(opt => {
                const selected = paymentMode === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setPaymentMode(opt.value)}
                    style={[styles.payOption, selected && styles.payOptionSelected]}
                  >
                    <View style={[styles.payIconWrap, selected && styles.payIconWrapSelected]}>
                      <Ionicons name={opt.icon as any} size={20} color={selected ? '#fff' : '#F97316'} />
                    </View>
                    <Text style={[styles.payOptionLabel, selected && styles.payOptionLabelSelected]}>
                      {opt.label}
                    </Text>
                    <View style={[styles.payRadio, selected && styles.payRadioSelected]}>
                      {selected ? <View style={styles.payRadioDot} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.payConfirmBtn, confirmingPayment && { opacity: 0.7 }]}
              onPress={handleConfirmPayment}
              disabled={confirmingPayment}
            >
              {confirmingPayment ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payConfirmText}>Confirm Payment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PDF Preview Modal */}
      <Modal visible={showPdfPreview} animationType="slide" onRequestClose={() => setShowPdfPreview(false)}>
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={[styles.pdfHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setShowPdfPreview(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.pdfHeaderTitle} numberOfLines={1}>
              {invoice?.invoice_number || 'Invoice'}
            </Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
            <Ionicons name="document-outline" size={64} color="#CBD5E1" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#64748B', marginTop: 16 }}>PDF Preview</Text>
            <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
              PDF preview available in the full app build
            </Text>
            <TouchableOpacity
              style={{ marginTop: 20, backgroundColor: '#F97316', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
              onPress={() => Linking.openURL(`https://api.udyogbook.in/api/v1/public/invoice/${invoice?.share_token}/pdf`)}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Open in Browser</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { padding: 4, marginRight: 8 },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  shareBtn: { padding: 4 },
  content: { padding: 12, gap: 10, paddingBottom: 20 },
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
  partialBadge: { backgroundColor: '#EFF6FF' },
  partialText: { color: '#2563EB' },
  paidBtn: { backgroundColor: Colors.success, borderRadius: Radius.sm, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  paidBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  actionBtn: { borderRadius: Radius.sm, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  pdfHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#0F172A' },
  pdfHeaderTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 8 },
  payOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  paySheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  paySheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 12 },
  payHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  payTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  paySubtitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16 },
  payOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  payOptionSelected: { borderColor: '#F97316', backgroundColor: '#FFF7ED' },
  payIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  payIconWrapSelected: { backgroundColor: '#F97316' },
  payOptionLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A' },
  payOptionLabelSelected: { color: '#C2410C' },
  payRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  payRadioSelected: { borderColor: '#F97316' },
  payRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F97316' },
  payConfirmBtn: { backgroundColor: '#F97316', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  payConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
