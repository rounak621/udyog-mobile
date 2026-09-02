import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeScrollView } from '../../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../../constants/theme';
import { api, setAuthToken, API_BASE_URL } from '../../../services/api';
import { quotationService, Quotation } from '../../../services/quotation';
import { showApiError } from '../../../utils/apiError';
import { getPdfViewerHtml } from '../../../utils/pdfViewerHtml';
import { savePdfToAndroidOrShare } from '../../../services/safHelper';
import { useBusiness } from '../../../context/BusinessContext';

export default function QuotationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const { business } = useBusiness();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [converting, setConverting] = useState(false);

  // PDF Preview states
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);

  const loadQuotation = async () => {
    try {
      const token = await getToken();
      setAuthToken(token);

      let bId = business?.id;
      if (!bId) {
        const bizRes = await api.get('/businesses/me');
        bId = bizRes.data.id;
      }

      if (!bId || !id) return;
      const data = await quotationService.getQuotation(id, bId);
      setQuotation(data);
    } catch (err: any) {
      console.log('Error loading quotation:', err);
      showApiError(err, 'Failed to load quotation');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadQuotation();
    }, [id])
  );

  useEffect(() => {
    if (showPdfPreview) {
      setWebViewLoading(true);
      setHasError(false);
    }
  }, [showPdfPreview]);

  // Public URL for PDF preview — identical to invoice share-token pattern
  const previewPdfUrl = quotation?.share_token
    ? `${API_BASE_URL}/public/quotation/${quotation.share_token}/pdf?mode=inline`
    : '';
  const pdfViewerHtml = previewPdfUrl ? getPdfViewerHtml(previewPdfUrl) : '';

  // Download PDF
  const handleDownloadPDF = async () => {
    if (!quotation?.share_token) {
      Alert.alert('Unavailable', 'PDF preview is not ready yet.');
      return;
    }
    setDownloadingPdf(true);
    try {
      const custName = (quotation.customer?.name || quotation.walk_in_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
      const quoNum = (quotation.quotation_number || 'Quotation').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Quotation_${custName}_${quoNum}.pdf`;

      const pdfUrl = `${API_BASE_URL}/public/quotation/${quotation.share_token}/pdf`;
      const fileUri = (FileSystem as any).cacheDirectory + fileName;

      const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);
      if (downloadResult.status === 200) {
        await savePdfToAndroidOrShare(downloadResult.uri, fileName, `Save ${fileName}`, 'Quotations');
      } else {
        throw new Error('Download failed');
      }
    } catch (err: any) {
      console.log('Quotation download error:', err);
      showApiError(err, 'Could not download quotation PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // WhatsApp / Native Share
  const handleSharePDF = async () => {
    if (!quotation?.share_token) {
      Alert.alert('Unavailable', 'PDF preview is not ready yet.');
      return;
    }
    setSharingPdf(true);
    try {
      const custName = (quotation.customer?.name || quotation.walk_in_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
      const quoNum = (quotation.quotation_number || 'Quotation').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Quotation_${custName}_${quoNum}.pdf`;

      const pdfUrl = `${API_BASE_URL}/public/quotation/${quotation.share_token}/pdf`;
      const fileUri = (FileSystem as any).cacheDirectory + fileName;

      const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);
      if (downloadResult.status === 200) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Quotation ${quotation.quotation_number}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        throw new Error('Download failed');
      }
    } catch (err: any) {
      console.log('Quotation share error:', err);
      showApiError(err, 'Could not share quotation PDF.');
    } finally {
      setSharingPdf(false);
    }
  };

  // Actions
  const handleAccept = async () => {
    if (!quotation) return;
    setAccepting(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      const updated = await quotationService.acceptQuotation(quotation.id, quotation.business_id);
      setQuotation(updated);
      Alert.alert('Accepted', `Quotation #${quotation.quotation_number} has been marked as Accepted.`);
    } catch (err: any) {
      showApiError(err, 'Failed to accept quotation');
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!quotation) return;
    Alert.alert(
      'Reject Quotation',
      `Are you sure you want to mark quotation #${quotation.quotation_number} as Rejected?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setRejecting(true);
            try {
              const token = await getToken();
              setAuthToken(token);
              const updated = await quotationService.rejectQuotation(quotation.id, quotation.business_id);
              setQuotation(updated);
            } catch (err: any) {
              showApiError(err, 'Failed to reject quotation');
            } finally {
              setRejecting(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!quotation) return;
    Alert.alert(
      'Delete Quotation',
      `Are you sure you want to delete quotation #${quotation.quotation_number}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const token = await getToken();
              setAuthToken(token);
              await quotationService.deleteQuotation(quotation.id, quotation.business_id);
              router.replace('/quotations');
            } catch (err: any) {
              showApiError(err, 'Failed to delete quotation');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleConvertToInvoice = async () => {
    if (!quotation) return;
    Alert.alert(
      'Convert to Invoice',
      `Convert quotation #${quotation.quotation_number} into a Sales Invoice?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert Now',
          onPress: async () => {
            setConverting(true);
            try {
              const token = await getToken();
              setAuthToken(token);
              const newInvoice = await quotationService.convertToInvoice(quotation.id, quotation.business_id);
              // Direct navigation to the created invoice detail screen
              if (newInvoice?.id) {
                router.replace(`/invoice/${newInvoice.id}`);
              } else {
                router.replace('/(tabs)/bills');
              }
            } catch (err: any) {
              showApiError(err, 'Failed to convert quotation to invoice');
            } finally {
              setConverting(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const fmt = (n?: number | string | null) =>
    '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!quotation) {
    return (
      <View style={styles.centerContainer}>
        <Text style={{ color: Colors.textMuted, fontSize: 14 }}>Quotation not found.</Text>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.replace('/quotations')}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Go to Quotations</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPending = quotation.status === 'PENDING';
  const isAccepted = quotation.status === 'ACCEPTED';
  const isConverted = !!quotation.converted_invoice_id;

  const getStatusBadge = () => {
    if (isConverted) {
      return { label: 'CONVERTED', badge: styles.convertedBadge, text: styles.convertedText };
    }
    switch (quotation.status) {
      case 'ACCEPTED':
        return { label: 'ACCEPTED', badge: styles.acceptedBadge, text: styles.acceptedText };
      case 'REJECTED':
        return { label: 'REJECTED', badge: styles.rejectedBadge, text: styles.rejectedText };
      case 'EXPIRED':
        return { label: 'EXPIRED', badge: styles.expiredBadge, text: styles.expiredText };
      default:
        return { label: 'PENDING', badge: styles.pendingBadge, text: styles.pendingText };
    }
  };

  const statusBadge = getStatusBadge();
  const customerName = quotation.customer?.name || quotation.walk_in_name || 'Customer';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Top Header */}
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {quotation.quotation_number}
          </Text>
          <Text style={styles.headerSub}>Estimate / Quotation</Text>
        </View>
        <View style={[styles.badge, statusBadge.badge]}>
          <Text style={[styles.badgeText, statusBadge.text]}>{statusBadge.label}</Text>
        </View>
      </View>

      <SafeScrollView baseBottomPadding={40} showsVerticalScrollIndicator={false}>
        {/* Converted to Invoice Banner */}
        {isConverted && (
          <TouchableOpacity
            style={styles.convertedBanner}
            onPress={() => router.push(`/invoice/${quotation.converted_invoice_id}`)}
          >
            <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
            <View style={{ flex: 1 }}>
              <Text style={styles.convertedBannerTitle}>Converted to Sales Invoice</Text>
              <Text style={styles.convertedBannerSub}>Tap to view invoice #{quotation.converted_invoice_id}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#16A34A" />
          </TouchableOpacity>
        )}

        {/* Overview Card */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{customerName}</Text>
                {quotation.customer?.gstin ? (
                  <Text style={styles.metaText}>GSTIN: {quotation.customer.gstin}</Text>
                ) : null}
                {quotation.customer?.phone ? (
                  <Text style={styles.metaText}>Phone: {quotation.customer.phone}</Text>
                ) : null}
                {quotation.customer?.address ? (
                  <Text style={styles.metaText}>{quotation.customer.address}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amountText}>{fmt(quotation.total_amount)}</Text>
                <Text style={styles.amountSub}>Grand Total</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={styles.dateLabel}>ISSUE DATE</Text>
                <Text style={styles.dateValue}>{formatDate(quotation.issue_date)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.dateLabel}>VALID UNTIL</Text>
                <Text style={[styles.dateValue, !quotation.valid_until && { color: Colors.textMuted }]}>
                  {quotation.valid_until ? formatDate(quotation.valid_until) : 'No Expiry'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* PDF Actions Bar */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.pdfActionBtn, { flex: 1.2, backgroundColor: Colors.primary }]}
              onPress={() => setShowPdfPreview(true)}
            >
              <Ionicons name="eye-outline" size={18} color="#fff" />
              <Text style={[styles.pdfActionBtnText, { color: '#fff' }]}>Preview PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pdfActionBtn, { flex: 1, backgroundColor: '#25D366' }]}
              onPress={handleSharePDF}
              disabled={sharingPdf}
            >
              {sharingPdf ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                  <Text style={[styles.pdfActionBtnText, { color: '#fff' }]}>Share</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pdfActionBtn, { flex: 1, backgroundColor: '#0D9488' }]}
              onPress={handleDownloadPDF}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={[styles.pdfActionBtnText, { color: '#fff' }]}>Download</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Primary Convert to Invoice Action (When ACCEPTED and not converted) */}
        {isAccepted && !isConverted && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.convertBtn}
              onPress={handleConvertToInvoice}
              disabled={converting}
            >
              {converting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="swap-horizontal" size={20} color="#fff" />
                  <Text style={styles.convertBtnText}>Convert to Sales Invoice</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Status Lifecycle Actions for PENDING */}
        {isPending && !isConverted && (
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.lifecycleBtn, styles.acceptBtn]}
                onPress={handleAccept}
                disabled={accepting}
              >
                {accepting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={styles.lifecycleBtnText}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.lifecycleBtn, styles.rejectBtn]}
                onPress={handleReject}
                disabled={rejecting}
              >
                {rejecting ? (
                  <ActivityIndicator size="small" color={Colors.danger} />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={18} color={Colors.danger} />
                    <Text style={[styles.lifecycleBtnText, { color: Colors.danger }]}>Reject</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.lifecycleBtn, styles.editBtn]}
                onPress={() => router.push(`/quotations/create?id=${quotation.id}`)}
              >
                <Ionicons name="pencil-outline" size={18} color={Colors.text} />
                <Text style={[styles.lifecycleBtnText, { color: Colors.text }]}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Line Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ITEMS ({quotation.items?.length || 0})</Text>
          <View style={styles.card}>
            {(quotation.items || []).map((item, index) => {
              const isLast = index === (quotation.items?.length || 0) - 1;
              return (
                <View key={item.id || index}>
                  <View style={{ paddingVertical: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.item_name}
                      </Text>
                      <Text style={styles.itemLineTotal}>{fmt(item.line_total)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={styles.itemSubText}>
                        {item.quantity} {item.unit || 'units'} × {fmt(item.rate)}
                      </Text>
                      <Text style={styles.itemSubText}>
                        GST: {item.gst_rate}% ({fmt(item.tax_amount)})
                      </Text>
                    </View>
                    {item.hsn_code ? <Text style={styles.itemHsnText}>HSN: {item.hsn_code}</Text> : null}
                  </View>
                  {!isLast && <View style={styles.itemDivider} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Totals Breakdown */}
        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: '#FFF7ED' }]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Taxable Subtotal</Text>
              <Text style={styles.summaryValue}>{fmt(quotation.subtotal)}</Text>
            </View>

            {Number(quotation.cgst_amount) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>CGST</Text>
                <Text style={styles.summaryValue}>{fmt(quotation.cgst_amount)}</Text>
              </View>
            )}

            {Number(quotation.sgst_amount) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>SGST</Text>
                <Text style={styles.summaryValue}>{fmt(quotation.sgst_amount)}</Text>
              </View>
            )}

            {Number(quotation.igst_amount) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>IGST</Text>
                <Text style={styles.summaryValue}>{fmt(quotation.igst_amount)}</Text>
              </View>
            )}

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Tax</Text>
              <Text style={styles.summaryValue}>{fmt(quotation.total_tax_amount)}</Text>
            </View>

            {Number(quotation.round_off) !== 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Round Off</Text>
                <Text style={styles.summaryValue}>{fmt(quotation.round_off)}</Text>
              </View>
            )}

            <View style={styles.summaryDivider} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}>Total Amount</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.primary }}>
                {fmt(quotation.total_amount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Terms and Conditions */}
        {quotation.terms_and_conditions ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TERMS & CONDITIONS</Text>
            <View style={styles.card}>
              <Text style={styles.bodyText}>{quotation.terms_and_conditions}</Text>
            </View>
          </View>
        ) : null}

        {/* Notes */}
        {quotation.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NOTES</Text>
            <View style={styles.card}>
              <Text style={styles.bodyText}>{quotation.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* Delete button for pending/rejected */}
        {!isConverted && (
          <View style={[styles.section, { marginTop: 12, marginBottom: 20 }]}>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator color={Colors.danger} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  <Text style={styles.deleteBtnText}>Delete Quotation</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeScrollView>

      {/* PDF Preview Modal with WebView */}
      <Modal
        visible={showPdfPreview}
        animationType="slide"
        onRequestClose={() => setShowPdfPreview(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={[styles.pdfHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setShowPdfPreview(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.pdfHeaderTitle} numberOfLines={1}>
              {quotation.quotation_number}
            </Text>
            <TouchableOpacity onPress={handleDownloadPDF} style={{ padding: 6 }}>
              <Ionicons name="download-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, position: 'relative', backgroundColor: '#fff' }}>
            {!!quotation?.share_token && !hasError && (
              <WebView
                source={{ html: pdfViewerHtml }}
                style={{ flex: 1, backgroundColor: '#F8FAFC' }}
                originWhitelist={['*']}
                javaScriptEnabled={true}
                onLoadStart={() => setWebViewLoading(true)}
                onLoadEnd={() => setWebViewLoading(false)}
                onError={() => setHasError(true)}
                onMessage={event => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'error') {
                      console.log('[QUOTATION-PDF-VIEWER-ERROR]', data.message);
                      setHasError(true);
                    }
                  } catch (e) {
                    console.log('[QUOTATION-PDF-VIEWER-PARSE-ERROR]', e);
                  }
                }}
              />
            )}

            {webViewLoading && !hasError && (
              <View style={styles.webViewLoader}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ marginTop: 10, color: Colors.textMuted, fontSize: 13 }}>
                  Rendering Quotation PDF...
                </Text>
              </View>
            )}

            {hasError && (
              <View style={styles.pdfErrorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
                <Text style={styles.pdfErrorTitle}>Could not load PDF preview</Text>
                <Text style={styles.pdfErrorSub}>
                  You can still download or share the PDF directly to view it.
                </Text>
                <TouchableOpacity style={styles.pdfErrorBtn} onPress={handleDownloadPDF}>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Download PDF</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: 11, color: Colors.textMuted },
  section: { marginHorizontal: 16, marginTop: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 2,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  customerName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  metaText: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  amountText: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  amountSub: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  dateLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  dateValue: { fontSize: 13, fontWeight: '600', color: Colors.text, marginTop: 2 },
  convertedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#F0FDF4',
    padding: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  convertedBannerTitle: { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  convertedBannerSub: { fontSize: 12, color: '#15803D', marginTop: 1 },
  pdfActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.sm,
  },
  pdfActionBtnText: { fontSize: 13, fontWeight: '700' },
  convertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.md,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  convertBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  lifecycleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  acceptBtn: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  editBtn: { backgroundColor: '#F8FAFC', borderColor: Colors.border },
  lifecycleBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  itemName: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1, marginRight: 8 },
  itemLineTotal: { fontSize: 14, fontWeight: '700', color: Colors.text },
  itemSubText: { fontSize: 12, color: Colors.textSecondary },
  itemHsnText: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  itemDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: '#92400E' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#92400E' },
  summaryDivider: { height: 1, backgroundColor: '#FED7AA', marginVertical: 10 },
  bodyText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteBtnText: { color: Colors.danger, fontSize: 13, fontWeight: '600' },
  badge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  pendingBadge: { backgroundColor: '#FFF7ED' },
  pendingText: { color: '#C2410C' },
  acceptedBadge: { backgroundColor: '#F0FDF4' },
  acceptedText: { color: '#16A34A' },
  rejectedBadge: { backgroundColor: '#FEF2F2' },
  rejectedText: { color: '#DC2626' },
  expiredBadge: { backgroundColor: '#F1F5F9' },
  expiredText: { color: '#64748B' },
  convertedBadge: { backgroundColor: '#EFF6FF' },
  convertedText: { color: '#2563EB' },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backHomeBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    marginTop: 14,
  },
  pdfHeader: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  pdfHeaderTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, marginHorizontal: 12 },
  webViewLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfErrorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#fff',
  },
  pdfErrorTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 12 },
  pdfErrorSub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  pdfErrorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    marginTop: 18,
  },
});
