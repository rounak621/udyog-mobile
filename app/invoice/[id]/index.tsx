import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, Linking, Modal, TextInput,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { getPdfViewerHtml } from '../../../utils/pdfViewerHtml';
import { Colors, Spacing, Radius } from '../../../constants/theme';
import { api, setAuthToken, API_BASE_URL } from '../../../services/api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { savePdfToAndroidOrShare } from '../../../services/safHelper';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams();
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (showPdfPreview) {
      setWebViewLoading(true);
      setHasError(false);
    }
  }, [showPdfPreview]);

  const previewPdfUrl = invoice?.share_token
    ? `${API_BASE_URL}/public/invoice/${invoice.share_token}/pdf?mode=inline`
    : '';
  const pdfViewerHtml = previewPdfUrl ? getPdfViewerHtml(previewPdfUrl) : '';

  // Payment revert states
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertPaymentId, setRevertPaymentId] = useState<string | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      loadInvoice();
    }, [id])
  );

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleWhatsAppShare = async () => {
    try {
      const pdfUrl = `${API_BASE_URL}/public/invoice/${invoice.share_token}/pdf`;
      const fileUri = (FileSystem as any).cacheDirectory + `invoice_${invoice.invoice_number?.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);
      if (downloadResult.status === 200) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoice ${invoice.invoice_number}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        throw new Error('Download failed');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not share PDF');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const customerName = (invoice.customer_name || invoice.party_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
      const invoiceNum = (invoice.invoice_number || 'invoice').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${customerName}_${invoiceNum}.pdf`;

      const pdfUrl = `${API_BASE_URL}/public/invoice/${invoice.share_token}/pdf`;
      const fileUri = (FileSystem as any).cacheDirectory + fileName;

      const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);

      if (downloadResult.status === 200) {
        await savePdfToAndroidOrShare(downloadResult.uri, fileName, `Save ${fileName}`);
      } else {
        throw new Error('Download failed');
      }
    } catch (err) {
      console.log('Download error:', err);
      Alert.alert('Error', 'Could not download PDF. Please try again.');
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

  const ps = (invoice?.payment_status || 'UNPAID').toUpperCase();
  const isPaid = ps === 'PAID';
  const isPartial = ps === 'PARTIAL';
  const balanceDue = invoice ? Math.max(0, Number(invoice.total_amount) - Number(invoice.paid_amount || 0)) : 0;



  const handleRevertPayment = (paymentId: string) => {
    setRevertPaymentId(paymentId);
    setRevertReason('');
    setShowRevertModal(true);
  };

  const handleConfirmRevert = async () => {
    if (!revertPaymentId) return;
    setReverting(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.post(`/payments/${revertPaymentId}/revert?business_id=${invoice.business_id}`, {
        reason: revertReason.trim() || null
      });

      setShowRevertModal(false);
      setRevertPaymentId(null);
      setRevertReason('');
      await loadInvoice();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to revert payment');
    } finally {
      setReverting(false);
    }
  };

  const [downloadingStatement, setDownloadingStatement] = useState(false);

  const handleDownloadStatement = async () => {
    setDownloadingStatement(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      
      const customerName = (invoice.customer_name || invoice.party_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
      const invoiceNum = (invoice.invoice_number || 'invoice').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Statement_${customerName}_${invoiceNum}.pdf`;
      
      const pdfUrl = `${API_BASE_URL}/invoices/${id}/payment-statement-pdf?business_id=${invoice.business_id}`;
      const fileUri = (FileSystem as any).cacheDirectory + fileName;
      
      const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (downloadResult.status === 200) {
        await savePdfToAndroidOrShare(downloadResult.uri, fileName, `Statement ${invoice.invoice_number}`);
      } else {
        throw new Error('Download failed');
      }
    } catch (err) {
      console.log('Download statement error:', err);
      Alert.alert('Error', 'Could not download statement PDF');
    } finally {
      setDownloadingStatement(false);
    }
  };

  const [downloadingChallan, setDownloadingChallan] = useState(false);

  const handleDownloadChallan = async () => {
    setDownloadingChallan(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      
      const invoiceNum = (invoice.invoice_number || 'invoice').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `challan-${invoiceNum}.pdf`;
      
      const pdfUrl = `${API_BASE_URL}/invoices/${id}/challan-pdf?business_id=${invoice.business_id}`;
      const fileUri = (FileSystem as any).cacheDirectory + fileName;
      
      const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (downloadResult.status === 200) {
        await savePdfToAndroidOrShare(downloadResult.uri, fileName, 'Challan');
      } else {
        throw new Error('Download failed');
      }
    } catch (err) {
      console.log('Download challan error:', err);
      Alert.alert('Error', 'Could not download challan PDF. Please try again.');
    } finally {
      setDownloadingChallan(false);
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>;
  if (!invoice) return <View style={styles.loader}><Text style={{ color: Colors.textSecondary }}>Invoice not found</Text></View>;

  const shareUrl = `https://app.udyogbook.in/invoice/${invoice.id}`;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Invoice</Text>
        <TouchableOpacity
          onPress={() => {
            if (invoice.payment_status !== 'UNPAID') {
              Alert.alert(
                'Cannot Edit Invoice',
                "This invoice has a payment recorded, so it's locked. Revert the payment first if you need to edit it.",
                [{ text: 'OK' }]
              );
            } else {
              router.push(`/invoice/create?id=${id}`);
            }
          }}
          style={{ padding: 4, marginRight: 12 }}
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

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 20 + insets.bottom }]} showsVerticalScrollIndicator={false}>
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
              isPaid ? styles.paidBadge : 
              isPartial ? styles.partialBadge : 
              styles.unpaidBadge
            ]}>
              <Text style={[styles.badgeText,
                isPaid ? styles.paidText :
                isPartial ? styles.partialText :
                styles.unpaidText
              ]}>{ps}</Text>
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
                <Text style={styles.itemSub} textBreakStrategy="simple">{item.quantity} {item.unit || 'pcs'} × {fmt(item.rate || item.unit_price)} · GST {item.gst_rate || 0}%</Text>
              </View>
              <Text style={styles.itemAmount} textBreakStrategy="simple">{fmt(item.line_total || item.amount || item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.totalRow}><Text style={[styles.totalLabel, { width: 100 }]} numberOfLines={1}>Subtotal</Text><Text style={styles.totalVal} textBreakStrategy="simple">{fmt(invoice.taxable_amount || invoice.subtotal)}</Text></View>
          {invoice.cgst_amount > 0 && <View style={styles.totalRow}><Text style={[styles.totalLabel, { width: 100 }]} numberOfLines={1}>CGST</Text><Text style={styles.totalVal} textBreakStrategy="simple">{fmt(invoice.cgst_amount)}</Text></View>}
          {invoice.sgst_amount > 0 && <View style={styles.totalRow}><Text style={[styles.totalLabel, { width: 100 }]} numberOfLines={1}>SGST</Text><Text style={styles.totalVal} textBreakStrategy="simple">{fmt(invoice.sgst_amount)}</Text></View>}
          {invoice.igst_amount > 0 && <View style={styles.totalRow}><Text style={[styles.totalLabel, { width: 100 }]} numberOfLines={1}>IGST</Text><Text style={styles.totalVal} textBreakStrategy="simple">{fmt(invoice.igst_amount)}</Text></View>}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontSize: 15, fontWeight: '600', color: Colors.text, width: 100 }]} numberOfLines={1}>Total</Text>
            <Text style={[styles.totalVal, { fontSize: 16, fontWeight: '700', color: Colors.primary }]} textBreakStrategy="simple">{fmt(invoice.total_amount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontSize: 13, color: Colors.textSecondary, width: 100 }]} numberOfLines={1}>Paid Amount</Text>
            <Text style={[styles.totalVal, { fontSize: 13, color: Colors.success, fontWeight: '600' }]} textBreakStrategy="simple">{fmt(invoice.paid_amount || 0)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontSize: 13, color: Colors.textSecondary, width: 100 }]} numberOfLines={1}>Balance Due</Text>
            <Text style={[styles.totalVal, { fontSize: 13, color: balanceDue > 0 ? Colors.danger : Colors.success, fontWeight: '700' }]} textBreakStrategy="simple">{fmt(balanceDue)}</Text>
          </View>
        </View>

        {invoice.notes && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={{ fontSize: 13, color: Colors.textSecondary, lineHeight: 20 }}>{invoice.notes}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 4 }}>
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1, backgroundColor: '#2563EB' }]}
            onPress={() => setShowPdfPreview(true)}
          >
            <Ionicons name="eye-outline" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1, backgroundColor: '#16A34A' }]}
            onPress={handleWhatsAppShare}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>WhatsApp</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 4 }}>
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1, backgroundColor: '#475569' }]}
            onPress={handleDownloadPDF}
          >
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Save PDF</Text>
          </TouchableOpacity>
          {invoice?.invoice_type === 'INVOICE' && (
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1, backgroundColor: '#0D9488', opacity: downloadingChallan ? 0.7 : 1 }]}
              onPress={handleDownloadChallan}
              disabled={downloadingChallan}
            >
              {downloadingChallan ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: '#fff' }]}>Challan</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 6 }}>
          <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>Payment History</Text>
          {invoice.payments && invoice.payments.length > 0 && (
            <TouchableOpacity
              onPress={handleDownloadStatement}
              disabled={downloadingStatement}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              {downloadingStatement ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="download-outline" size={14} color={Colors.primary} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.primary }}>Download Statement</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.card}>
          {!(invoice.payments && invoice.payments.length > 0) ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ fontSize: 13, color: Colors.textMuted }}>No payments recorded yet</Text>
            </View>
          ) : (
            invoice.payments.map((p: any, index: number) => {
              const isReverted = !!p.is_reverted;
              const formattedDate = new Date(p.payment_date).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric'
              });
              return (
                <View key={p.id || index} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: index === invoice.payments.length - 1 ? 0 : 0.5, borderBottomColor: Colors.border }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[{ fontSize: 14, fontWeight: '700' }, isReverted ? { color: Colors.textMuted, textDecorationLine: 'line-through' } : { color: Colors.success }]}>
                        {fmt(Number(p.amount))}
                      </Text>
                      <View style={{ backgroundColor: '#F1F5F9', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.textSecondary }}>{p.mode}</Text>
                      </View>
                      {isReverted && (
                        <View style={{ backgroundColor: '#FEF2F2', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.danger }}>Reverted</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4 }}>
                      {formattedDate}
                    </Text>
                    {p.notes && !isReverted && (
                      <Text style={{ fontSize: 12, color: Colors.primary, marginTop: 4 }}>
                        {p.notes}
                      </Text>
                    )}
                    {isReverted && p.revert_reason && (
                      <Text style={{ fontSize: 11, color: Colors.danger, fontStyle: 'italic', marginTop: 2 }}>
                        Reason: {p.revert_reason}
                      </Text>
                    )}
                  </View>
                  {!isReverted && (
                    <TouchableOpacity
                      onPress={() => handleRevertPayment(p.id)}
                      style={{ padding: 6, borderRadius: 6, borderWidth: 0.5, borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }}
                    >
                      <Ionicons name="reload-outline" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {!isPaid && (
          <TouchableOpacity style={styles.paidBtn} onPress={() => router.push(`/invoice/${id}/record-payment`)}>
            <Ionicons name="cash-outline" size={18} color="#fff" />
            <Text style={styles.paidBtnText}>Record Payment</Text>
          </TouchableOpacity>
        )}


      </ScrollView>


      <Modal
        visible={showRevertModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowRevertModal(false); setRevertReason(''); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Revert Payment</Text>
            <Text style={styles.modalSub}>
              Are you sure you want to revert this payment? This will update the invoice's paid amount.
            </Text>

            <Text style={styles.inputLabel}>Reason (Optional)</Text>
            <TextInput
              style={[styles.textInput, { marginBottom: 20 }]}
              value={revertReason}
              onChangeText={setRevertReason}
              placeholder="Enter reason for reverting..."
              placeholderTextColor={Colors.textMuted}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setShowRevertModal(false); setRevertReason(''); }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmRevert}
                disabled={reverting}
                style={styles.modalConfirmBtn}
              >
                {reverting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Revert</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPdfPreview} animationType="slide" onRequestClose={() => setShowPdfPreview(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={[styles.pdfHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setShowPdfPreview(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.pdfHeaderTitle} numberOfLines={1}>
              {invoice?.invoice_number || 'Invoice'}
            </Text>
            <TouchableOpacity onPress={handleDownloadPDF} style={{ padding: 6 }}>
              <Ionicons name="download-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, position: 'relative', backgroundColor: '#fff' }}>
            {!!invoice?.share_token && !hasError && (
              <WebView
                source={{ html: pdfViewerHtml }}
                style={{ flex: 1, backgroundColor: '#F8FAFC' }}
                originWhitelist={['*']}
                javaScriptEnabled={true}
                onLoadStart={() => setWebViewLoading(true)}
                onLoadEnd={() => setWebViewLoading(false)}
                onError={() => setHasError(true)}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'error') {
                      console.log('[PDF-VIEWER-ERROR [id]]', data.message);
                      setHasError(true);
                    }
                  } catch (err) {
                    console.log('[PDF-VIEWER-ERROR-PARSE [id]]', err);
                  }
                }}
              />
            )}
            {hasError && (
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
                <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 10, textAlign: 'center' }}>
                  Could not load preview. Please try downloading or sharing the PDF instead.
                </Text>
              </View>
            )}
            {webViewLoading && !hasError && (
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.95)', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 10, fontWeight: '500' }}>Loading Preview...</Text>
              </View>
            )}
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
  itemAmount: { fontSize: 13, fontWeight: '500', color: Colors.text, flexShrink: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 13, color: Colors.textSecondary },
  totalVal: { fontSize: 13, color: Colors.text, fontWeight: '500', flexShrink: 1 },
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
  actionBtn: { borderRadius: 10, paddingVertical: 13, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  pdfHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#0F172A' },
  pdfHeaderTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 8 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  textInput: { height: 40, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 12, fontSize: 13, color: Colors.text, backgroundColor: '#f8fafc' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: Radius.md, padding: 20, width: '100%', maxWidth: 340, borderWidth: 0.5, borderColor: Colors.border },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  modalSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  modalCancelBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, borderWidth: 0.5, borderColor: Colors.border },
  modalCancelBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  modalConfirmBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: Colors.danger },
  modalConfirmBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' }
});
