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
import { SafeScrollView } from '../../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../../constants/theme';
import { api, setAuthToken } from '../../../services/api';
import {
  recurringBillsService,
  RecurringBillTemplate,
  RecurringBillGenerationLog,
} from '../../../services/recurringBills';
import { showApiError } from '../../../utils/apiError';
import { getPdfViewerHtml } from '../../../utils/pdfViewerHtml';
import { useBusiness } from '../../../context/BusinessContext';

export default function RecurringBillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const { business } = useBusiness();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [template, setTemplate] = useState<RecurringBillTemplate | null>(null);
  const [customerName, setCustomerName] = useState<string>('Customer');
  const [logs, setLogs] = useState<RecurringBillGenerationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // PDF Preview State (Stateless raw bytes, NO download button)
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const loadTemplate = async () => {
    try {
      const token = await getToken();
      setAuthToken(token);

      let bId = business?.id;
      if (!bId) {
        const bizRes = await api.get('/businesses/me');
        bId = bizRes.data?.id;
      }
      if (!bId || !id) return;

      const [templateRes, logsRes] = await Promise.all([
        recurringBillsService.get(bId, id),
        recurringBillsService.logs(bId, id),
      ]);

      setTemplate(templateRes);
      setLogs(logsRes || []);

      // Fetch customer name
      if (templateRes.customer_id) {
        try {
          const custRes = await api.get(`/customers/${templateRes.customer_id}?business_id=${bId}`);
          if (custRes.data?.name) {
            setCustomerName(custRes.data.name);
          }
        } catch {
          // Fallback to customer_name on template if any
          setCustomerName(templateRes.customer_name || 'Customer');
        }
      }
    } catch (err: any) {
      console.log('Error loading automated bill detail:', err);
      showApiError(err, 'Failed to load automated bill template');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTemplate();
    }, [id])
  );

  const handleToggleStatus = async (nextStatus: 'active' | 'paused') => {
    if (!template) return;
    setUpdatingStatus(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      const updated = await recurringBillsService.update(template.business_id, template.id, {
        status: nextStatus,
      });
      setTemplate(updated);
    } catch (err: any) {
      showApiError(err, `Failed to ${nextStatus === 'active' ? 'resume' : 'pause'} automated bill`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStop = () => {
    if (!template) return;
    Alert.alert(
      'Stop Automated Bill',
      'Stopping this automated bill is permanent. Once stopped, it cannot be resumed or restarted. Are you sure you want to stop it?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop Permanently',
          style: 'destructive',
          onPress: async () => {
            setUpdatingStatus(true);
            try {
              const token = await getToken();
              setAuthToken(token);
              const updated = await recurringBillsService.update(template.business_id, template.id, {
                status: 'stopped',
              });
              setTemplate(updated);
            } catch (err: any) {
              showApiError(err, 'Failed to stop automated bill');
            } finally {
              setUpdatingStatus(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!template) return;
    Alert.alert(
      'Delete Automated Bill',
      'Are you sure you want to delete this automated bill template? Future generation will be cancelled.',
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
              await recurringBillsService.remove(template.business_id, template.id);
              router.replace('/automated-bills');
            } catch (err: any) {
              showApiError(err, 'Failed to delete template');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handlePreviewPdf = async () => {
    if (!template) return;
    setGeneratingPdf(true);
    setPdfError(false);
    try {
      const token = await getToken();
      setAuthToken(token);

      const payload = {
        customer_id: template.customer_id,
        start_date: template.start_date,
        notes: template.notes,
        line_items: (template.line_items || []).map(l => ({
          item_id: l.item_id || null,
          item_name: l.item_name || 'Item',
          quantity: Number(l.quantity) || 1,
          rate: Number(l.rate) || 0,
          gst_rate: Number(l.gst_rate) || 0,
          hsn_code: l.hsn_code || null,
          description: l.description || null,
          discount_percent: Number(l.discount_percent) || 0,
        })),
      };

      const arrayBuffer = await recurringBillsService.previewPdf(template.business_id, payload);
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);

      // Cache file locally
      const cacheUri = `${(FileSystem as any).cacheDirectory}recurring_preview_${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(cacheUri, b64, { encoding: 'base64' });

      setPreviewBase64(b64);
      setShowPdfPreview(true);
    } catch (err: any) {
      console.log('Preview error:', err);
      showApiError(err, 'Could not generate PDF preview');
      setPdfError(true);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const formatSchedule = (freq: string, day: number | null, time: string | null) => {
    const fCap = freq.charAt(0).toUpperCase() + freq.slice(1);
    let timeStr = '';
    if (time) {
      const [h, m] = time.split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const formattedHour = hour % 12 || 12;
      timeStr = ` @ ${formattedHour}:${m} ${ampm}`;
    }

    if (freq === 'monthly' || freq === 'quarterly') {
      const dayStr = day ? `Day ${day}` : 'Day 1';
      return `${fCap} (${dayStr}${timeStr})`;
    }
    return `${fCap}${timeStr ? ` (${timeStr.trim()})` : ''}`;
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

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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

  if (!template) {
    return (
      <View style={styles.centerContainer}>
        <Text style={{ color: Colors.textMuted, fontSize: 14 }}>Automated bill template not found.</Text>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.replace('/automated-bills')}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Go to Automated Bills</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isStopped = template.status === 'stopped';
  const isPaused = template.status === 'paused';
  const isActive = template.status === 'active';

  let estTotal = 0;
  (template.line_items || []).forEach(item => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const gst = Number(item.gst_rate) || 0;
    const disc = Number(item.discount_percent) || 0;
    const taxable = qty * rate * (1 - disc / 100);
    estTotal += taxable * (1 + gst / 100);
  });

  const pdfViewerHtml = previewBase64 ? getPdfViewerHtml(`data:application/pdf;base64,${previewBase64}`) : '';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Top Header */}
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {customerName}
          </Text>
          <Text style={styles.headerSub}>Automated Bill Template</Text>
        </View>
        <View
          style={[
            styles.badge,
            isActive && styles.activeBadge,
            isPaused && styles.pausedBadge,
            isStopped && styles.stoppedBadge,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              isActive && styles.activeText,
              isPaused && styles.pausedText,
              isStopped && styles.stoppedText,
            ]}
          >
            {template.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <SafeScrollView baseBottomPadding={40} showsVerticalScrollIndicator={false}>
        {/* Schedule & Overview Card */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{customerName}</Text>
                <Text style={styles.scheduleText}>
                  {formatSchedule(template.frequency, template.billing_day, template.billing_time)}
                </Text>
                <Text style={styles.metaText}>
                  Auto-Send: {template.auto_send_enabled ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amountText}>{fmt(estTotal)}</Text>
                <Text style={styles.amountSub}>Est. Per Bill</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={styles.dateLabel}>START DATE</Text>
                <Text style={styles.dateValue}>{formatDate(template.start_date)}</Text>
              </View>
              <View>
                <Text style={styles.dateLabel}>NEXT RUN DATE</Text>
                <Text style={[styles.dateValue, { color: Colors.primary }]}>{formatDate(template.next_run_date)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.dateLabel}>END DATE</Text>
                <Text style={[styles.dateValue, !template.end_date && { color: Colors.textMuted }]}>
                  {template.end_date ? formatDate(template.end_date) : 'Ongoing'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Schedule Informational Notice */}
        <View style={styles.section}>
          <View style={styles.infoBanner}>
            <Ionicons name="calendar-outline" size={20} color="#0284C7" />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoBannerTitle}>Automatic Generation</Text>
              <Text style={styles.infoBannerSub}>
                Invoices fire automatically according to the scheduled run date and time. Backend scheduler handles execution without manual intervention.
              </Text>
            </View>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Preview Action (Stateless) */}
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1.2, backgroundColor: Colors.primary }]}
              onPress={handlePreviewPdf}
              disabled={generatingPdf}
            >
              {generatingPdf ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="eye-outline" size={18} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: '#fff' }]}>Preview PDF</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Pause / Resume Button */}
            {!isStopped && (
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { flex: 1, backgroundColor: isActive ? '#FFF7ED' : '#F0FDF4', borderWidth: 1, borderColor: isActive ? '#FED7AA' : '#BBF7D0' },
                ]}
                onPress={() => handleToggleStatus(isActive ? 'paused' : 'active')}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <ActivityIndicator size="small" color={isActive ? Colors.primary : Colors.success} />
                ) : (
                  <>
                    <Ionicons
                      name={isActive ? 'pause-outline' : 'play-outline'}
                      size={18}
                      color={isActive ? Colors.primary : Colors.success}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        { color: isActive ? Colors.primary : Colors.success },
                      ]}
                    >
                      {isActive ? 'Pause' : 'Resume'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Edit Button */}
            {!isStopped && (
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 0.8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: Colors.border }]}
                onPress={() => router.push(`/automated-bills/create?id=${template.id}`)}
              >
                <Ionicons name="pencil-outline" size={18} color={Colors.text} />
                <Text style={[styles.actionBtnText, { color: Colors.text }]}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stop Button (Permanent) */}
        {!isStopped && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={handleStop}
              disabled={updatingStatus}
            >
              <Ionicons name="stop-circle-outline" size={18} color="#C2410C" />
              <Text style={styles.stopBtnText}>Stop Recurring Bill (Permanent)</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Template Line Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LINE ITEMS ({template.line_items?.length || 0})</Text>
          <View style={styles.card}>
            {(template.line_items || []).map((item, index) => {
              const qty = Number(item.quantity) || 1;
              const rate = Number(item.rate) || 0;
              const gst = Number(item.gst_rate) || 0;
              const disc = Number(item.discount_percent) || 0;
              const lineTotal = qty * rate * (1 - disc / 100) * (1 + gst / 100);
              const isLast = index === (template.line_items?.length || 0) - 1;

              return (
                <View key={item.id || index}>
                  <View style={{ paddingVertical: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.item_name || 'Item'}
                      </Text>
                      <Text style={styles.itemLineTotal}>{fmt(lineTotal)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={styles.itemSubText}>
                        {qty} {item.unit || 'units'} × {fmt(rate)}
                      </Text>
                      <Text style={styles.itemSubText}>GST: {gst}%</Text>
                    </View>
                    {item.hsn_code ? <Text style={styles.itemHsnText}>HSN: {item.hsn_code}</Text> : null}
                  </View>
                  {!isLast && <View style={styles.itemDivider} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Notes if present */}
        {template.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NOTES</Text>
            <View style={styles.card}>
              <Text style={styles.bodyText}>{template.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* Execution Logs Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EXECUTION HISTORY ({logs.length})</Text>
          {logs.length === 0 ? (
            <View style={[styles.card, styles.emptyLogsCard]}>
              <Ionicons name="time-outline" size={24} color={Colors.textMuted} />
              <Text style={styles.emptyLogsTitle}>No Invoices Generated Yet</Text>
              <Text style={styles.emptyLogsSub}>
                The first invoice is scheduled to generate automatically on {formatDate(template.next_run_date)}.
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              {logs.map((log, index) => {
                const isSuccess = log.status === 'success';
                const isLast = index === logs.length - 1;

                return (
                  <View key={log.id || index}>
                    <View style={{ paddingVertical: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={[styles.badge, isSuccess ? styles.successBadge : styles.failedBadge]}>
                          <Text style={[styles.badgeText, isSuccess ? styles.successText : styles.failedText]}>
                            {log.status.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.logTimestamp}>{formatDateTime(log.created_at)}</Text>
                      </View>

                      {log.generated_invoice_id && (
                        <TouchableOpacity
                          style={styles.viewInvoiceBtn}
                          onPress={() => router.push(`/invoice/${log.generated_invoice_id}`)}
                        >
                          <Ionicons name="document-text-outline" size={14} color={Colors.primary} />
                          <Text style={styles.viewInvoiceBtnText}>
                            View Invoice #{log.generated_invoice_id}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {log.error_message && (
                        <Text style={styles.logErrorText}>{log.error_message}</Text>
                      )}
                    </View>
                    {!isLast && <View style={styles.itemDivider} />}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Delete button */}
        <View style={[styles.section, { marginTop: 16, marginBottom: 24 }]}>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator color={Colors.danger} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                <Text style={styles.deleteBtnText}>Delete Template</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeScrollView>

      {/* PDF Preview Modal — Preview only, NO download button */}
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
              Preview Template Invoice
            </Text>
            {/* Explicitly no download button in preview mode */}
            <View style={{ width: 36 }} />
          </View>

          <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {previewBase64 && !pdfError && (
              <WebView
                source={{ html: pdfViewerHtml }}
                style={{ flex: 1 }}
                originWhitelist={['*']}
                javaScriptEnabled={true}
                onError={() => setPdfError(true)}
              />
            )}

            {pdfError && (
              <View style={styles.centerContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
                <Text style={{ marginTop: 12, fontSize: 15, fontWeight: '700', color: Colors.text }}>
                  Could not load preview
                </Text>
                <Text style={{ marginTop: 6, fontSize: 13, color: Colors.textMuted, textAlign: 'center' }}>
                  Please check your connection and try again.
                </Text>
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
  scheduleText: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  metaText: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  amountText: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  amountSub: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  dateLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  dateValue: { fontSize: 13, fontWeight: '600', color: Colors.text, marginTop: 2 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: Radius.md,
    padding: 12,
  },
  infoBannerTitle: { fontSize: 13, fontWeight: '700', color: '#0369A1' },
  infoBannerSub: { fontSize: 11.5, color: '#0284C7', marginTop: 2, lineHeight: 16 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.sm,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  stopBtnText: { color: '#C2410C', fontSize: 13, fontWeight: '600' },
  itemName: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1, marginRight: 8 },
  itemLineTotal: { fontSize: 14, fontWeight: '700', color: Colors.text },
  itemSubText: { fontSize: 12, color: Colors.textSecondary },
  itemHsnText: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  itemDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  bodyText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  emptyLogsCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 6 },
  emptyLogsTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  emptyLogsSub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 16, lineHeight: 16 },
  badge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  activeBadge: { backgroundColor: '#F0FDF4' },
  activeText: { color: '#16A34A' },
  pausedBadge: { backgroundColor: '#FFF7ED' },
  pausedText: { color: '#C2410C' },
  stoppedBadge: { backgroundColor: '#F1F5F9' },
  stoppedText: { color: '#64748B' },
  successBadge: { backgroundColor: '#F0FDF4' },
  successText: { color: '#16A34A' },
  failedBadge: { backgroundColor: '#FEF2F2' },
  failedText: { color: '#DC2626' },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  logTimestamp: { fontSize: 12, color: Colors.textMuted },
  viewInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  viewInvoiceBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  logErrorText: { fontSize: 11.5, color: Colors.danger, marginTop: 4 },
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
  pdfHeaderTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
});
