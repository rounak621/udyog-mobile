import { useAuth } from '@clerk/clerk-expo';
import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Modal, TextInput, ScrollView, Switch,
  Platform
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { savePdfToAndroidOrShare } from '../../../services/safHelper';
import { SafeScrollView } from '../../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../../constants/theme';
import { api, setAuthToken } from '../../../services/api';
import { useBusiness } from '../../../context/BusinessContext';

interface RentalOrderItem {
  id: string;
  rental_product_id?: string;
  quantity_rented: number;
  rate_per_unit_per_day: string;
  amount: string;
  quantity_returned: number;
  return_notes?: string;
  asset_codes?: string; // JSON string
  product_name?: string;
  gst_rate: number;
  custom_description?: string;
}

interface RentalOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  status: 'ACTIVE' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED';
  invoice_date?: string;
  start_date: string;
  end_date: string;
  actual_return_date?: string;
  rental_rate_type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  security_deposit: string;
  deposit_status: 'HELD' | 'RETURNED' | 'DEDUCTED';
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  payment_status: 'PAID' | 'PARTIAL' | 'UNPAID';
  paid_amount: string;
  late_fee_per_day: string;
  late_fee_total: string;
  notes?: string;
  items: RentalOrderItem[];
  days_overdue?: number;
  share_token?: string;
}

const CONDITION_OPTIONS = [
  { label: 'Excellent', value: 'EXCELLENT' },
  { label: 'Good', value: 'GOOD' },
  { label: 'Damaged', value: 'DAMAGED' },
  { label: 'Write-off', value: 'WRITE_OFF' }
];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { business } = useBusiness();

  const [order, setOrder] = useState<RentalOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Return Modal states
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [qtyToReturn, setQtyToReturn] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('GOOD');
  const [damageNotes, setDamageNotes] = useState('');
  const [damageDeduction, setDamageDeduction] = useState('');
  const [waiveLateFee, setWaiveLateFee] = useState(false);
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');



  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [downloadingStatement, setDownloadingStatement] = useState(false);

  const loadOrderDetails = useCallback(async () => {
    if (!id || !business?.id) return;
    try {
      const token = await getToken();
      setAuthToken(token);
      setLoadingPayments(true);
      const [orderRes, paymentsRes] = await Promise.all([
        api.get(`/rental-orders/${id}?business_id=${business.id}`),
        api.get(`/rental-orders/${id}/payments?business_id=${business.id}`)
      ]);
      setOrder(orderRes.data);
      setPayments(paymentsRes.data.payments || []);
    } catch (err) {
      console.log('Error fetching rental order details:', err);
      Alert.alert('Error', 'Failed to load order details.');
    } finally {
      setLoading(false);
      setLoadingPayments(false);
    }
  }, [id, business?.id, getToken]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadOrderDetails();
    }, [loadOrderDetails])
  );

  const handleCancelOrder = async () => {
    if (!order || !business?.id) return;
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this rental order? This will release allocated assets and reverse transactions.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              const token = await getToken();
              setAuthToken(token);
              await api.post(`/rental-orders/${order.id}/cancel?business_id=${business.id}`);
              Alert.alert('Success', 'Order cancelled successfully.');
              loadOrderDetails();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.detail || 'Failed to cancel order.');
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleDownloadPDF = async () => {
    if (!order || !business?.id) return;
    try {
      setDownloading(true);
      const token = await getToken();
      
      const safeOrderNumber = order.order_number.replace(/[\/\\]/g, '_');
      const safeCustomerName = (order.customer_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${safeCustomerName}_${safeOrderNumber}_invoice.pdf`;
      
      const fileUri = (FileSystem as any).cacheDirectory + fileName;
      
      const response = await FileSystem.downloadAsync(
        `${api.defaults.baseURL}/rental-orders/${order.id}/pdf?business_id=${business.id}`,
        fileUri,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.status === 200) {
        await savePdfToAndroidOrShare(response.uri, fileName, `Save ${fileName}`);
      } else {
        Alert.alert('Error', 'Failed to generate invoice PDF.');
      }
    } catch (err) {
      console.log('PDF download error:', err);
      Alert.alert('Error', 'Failed to download and share invoice.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadStatement = async () => {
    if (!order || !business?.id) return;
    try {
      setDownloadingStatement(true);
      const token = await getToken();
      
      const safeOrderNumber = order.order_number.replace(/[\/\\]/g, '_');
      const safeCustomerName = (order.customer_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${safeCustomerName}_${safeOrderNumber}_statement.pdf`;
      
      const fileUri = (FileSystem as any).cacheDirectory + fileName;
      
      const response = await FileSystem.downloadAsync(
        `${api.defaults.baseURL}/rental-orders/${order.id}/payment-statement-pdf?business_id=${business.id}`,
        fileUri,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.status === 200) {
        await savePdfToAndroidOrShare(response.uri, fileName, `Save ${fileName}`);
      } else {
        Alert.alert('Error', 'Failed to generate statement PDF.');
      }
    } catch (err) {
      console.log('Statement download error:', err);
      Alert.alert('Error', 'Failed to download and share statement.');
    } finally {
      setDownloadingStatement(false);
    }
  };



  const handleWaiveFee = async () => {
    if (!order || !business?.id) return;
    Alert.alert(
      'Waive Late Fee',
      'Are you sure you want to waive all late fees for this order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Waive Fees',
          onPress: async () => {
            try {
              setSubmitting(true);
              const token = await getToken();
              setAuthToken(token);
              await api.post(`/rental-orders/${order.id}/waive-fee?business_id=${business.id}`);
              Alert.alert('Success', 'Late fees waived successfully.');
              loadOrderDetails();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.detail || 'Failed to waive late fees.');
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleRecordReturn = async () => {
    if (!order || !business?.id) return;

    const qty = parseInt(qtyToReturn);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid quantity.');
      return;
    }

    const totalRented = order.items.reduce((acc, it) => acc + it.quantity_rented, 0);
    const totalReturned = order.items.reduce((acc, it) => acc + it.quantity_returned, 0);
    const remaining = totalRented - totalReturned;

    if (qty > remaining) {
      Alert.alert('Validation Error', `Cannot return ${qty} units. Only ${remaining} remaining.`);
      return;
    }

    try {
      setSubmitting(true);
      const token = await getToken();
      setAuthToken(token);

      const payload = {
        quantity_returned: qty,
        condition: selectedCondition,
        damage_notes: (selectedCondition === 'DAMAGED' || selectedCondition === 'WRITE_OFF') ? damageNotes.trim() || null : null,
        damage_deduction: (selectedCondition === 'DAMAGED' || selectedCondition === 'WRITE_OFF') ? parseFloat(damageDeduction) || 0 : 0,
        waive_late_fee: waiveLateFee,
        mark_as_paid: markAsPaid,
        payment_method: markAsPaid ? paymentMethod : 'CASH'
      };

      await api.post(`/rental-orders/${order.id}/return?business_id=${business.id}`, payload);
      Alert.alert('Success', 'Return recorded successfully.');
      setShowReturnModal(false);
      
      // Reset Modal values
      setQtyToReturn('');
      setSelectedCondition('GOOD');
      setDamageNotes('');
      setDamageDeduction('');
      setWaiveLateFee(false);
      setMarkAsPaid(false);
      setPaymentMethod('CASH');

      loadOrderDetails();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to record return.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return { bg: '#F0FDF4', text: '#16A34A' };
      case 'OVERDUE':
        return { bg: '#FEF2F2', text: '#DC2626' };
      case 'CANCELLED':
        return { bg: '#F1F5F9', text: '#64748B' };
      default:
        return { bg: '#EFF6FF', text: '#2563EB' };
    }
  };

  const getPaymentStatusStyle = (status: string) => {
    switch (status) {
      case 'PAID':
        return { bg: '#F0FDF4', text: '#16A34A' };
      case 'PARTIAL':
        return { bg: '#EFF6FF', text: '#2563EB' };
      default:
        return { bg: '#FFF7ED', text: '#C2410C' };
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading || !order) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const statusStyle = getStatusStyle(order.status);
  const payStyle = getPaymentStatusStyle(order.payment_status);

  const totalRented = order.items.reduce((acc, it) => acc + it.quantity_rented, 0);
  const totalReturned = order.items.reduce((acc, it) => acc + it.quantity_returned, 0);
  const remainingToReturn = totalRented - totalReturned;

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 6 }}>
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>Order #{order.order_number}</Text>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg, alignSelf: 'flex-start', marginTop: 2 }]}>
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>{order.status}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => {
              if (order.share_token) {
                router.push(`/rental-order/pdf-preview?shareToken=${order.share_token}`);
              } else {
                Alert.alert('Error', 'Invoice preview is not available.');
              }
            }}
            style={[styles.headerIconBtn, { marginRight: 4 }]}
          >
            <Ionicons name="eye-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDownloadPDF} disabled={downloading} style={styles.headerIconBtn}>
            {downloading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="download-outline" size={20} color={Colors.primary} />
            )}
          </TouchableOpacity>

          {(order.status === 'ACTIVE' || order.status === 'OVERDUE') && (
            <TouchableOpacity onPress={handleCancelOrder} disabled={submitting} style={[styles.headerIconBtn, { marginLeft: 4 }]}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <SafeScrollView baseBottomPadding={40} contentContainerStyle={{ padding: 14 }} showsVerticalScrollIndicator={false}>
        {/* Customer & Timeline Card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Customer & Timeline</Text>
          <Text style={styles.customerName}>{order.customer_name || 'Unknown Customer'}</Text>

          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.fieldLabel}>Invoice Date</Text>
              <Text style={styles.fieldValue}>{formatDate(order.invoice_date)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.fieldLabel}>Rate Cycle</Text>
              <Text style={styles.fieldValue}>{order.rental_rate_type}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.fieldLabel}>Start Date</Text>
              <Text style={styles.fieldValue}>{formatDate(order.start_date)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.fieldLabel}>End Date</Text>
              <Text style={styles.fieldValue}>{formatDate(order.end_date)}</Text>
            </View>
            {order.actual_return_date && (
              <View style={styles.gridItem}>
                <Text style={styles.fieldLabel}>Returned Date</Text>
                <Text style={[styles.fieldValue, { color: '#16A34A' }]}>{formatDate(order.actual_return_date)}</Text>
              </View>
            )}
            {order.days_overdue !== undefined && order.days_overdue > 0 && (
              <View style={styles.gridItem}>
                <Text style={styles.fieldLabel}>Overdue</Text>
                <Text style={[styles.fieldValue, { color: Colors.danger, fontWeight: '700' }]}>
                  {order.days_overdue} days
                </Text>
              </View>
            )}
          </View>

          {order.notes ? (
            <View style={{ marginTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 10 }}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <Text style={[styles.fieldValue, { fontStyle: 'italic', color: Colors.textSecondary }]}>{order.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Items Section */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Items Included</Text>
          {order.items.map((item, idx) => {
            let assetList: string[] = [];
            if (item.asset_codes) {
              try {
                assetList = JSON.parse(item.asset_codes);
              } catch (e) {
                // If it is already array or normal string
                if (Array.isArray(item.asset_codes)) assetList = item.asset_codes;
              }
            }

            return (
              <View key={item.id} style={[styles.itemRow, idx > 0 ? styles.itemBorder : null]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.product_name || item.custom_description || 'Rental Product'}</Text>
                    <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                      Rate: ₹{parseFloat(item.rate_per_unit_per_day).toLocaleString('en-IN')} / {order.rental_rate_type.toLowerCase()}
                      {item.gst_rate > 0 ? ` · GST: ${item.gst_rate}%` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.itemPrice}>₹{parseFloat(item.amount).toLocaleString('en-IN')}</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>
                      Qty: {item.quantity_rented} (Returned: {item.quantity_returned})
                    </Text>
                  </View>
                </View>

                {assetList.length > 0 && (
                  <View style={styles.assetsRow}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.textSecondary, marginRight: 6 }}>ASSETS:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                      {assetList.map((code) => (
                        <View key={code} style={styles.assetChip}>
                          <Text style={styles.assetChipText}>{code}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Financials card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Financial Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>Subtotal</Text>
            <Text style={styles.summaryVal}>₹{parseFloat(order.subtotal).toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>GST Taxes</Text>
            <Text style={styles.summaryVal}>₹{parseFloat(order.tax_amount).toLocaleString('en-IN')}</Text>
          </View>
          {parseFloat(order.security_deposit) > 0 && (
            <View style={styles.summaryRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.summaryText}>Security Deposit</Text>
                <View style={[styles.miniBadge, { marginLeft: 6 }]}>
                  <Text style={styles.miniBadgeText}>{order.deposit_status}</Text>
                </View>
              </View>
              <Text style={styles.summaryVal}>₹{parseFloat(order.security_deposit).toLocaleString('en-IN')}</Text>
            </View>
          )}
          {parseFloat(order.late_fee_total) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryText, { color: Colors.danger }]}>Late Fee Total</Text>
              <Text style={[styles.summaryVal, { color: Colors.danger }]}>₹{parseFloat(order.late_fee_total).toLocaleString('en-IN')}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, { borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 10, marginTop: 4 }]}>
            <Text style={[styles.summaryText, { fontWeight: '700', color: Colors.text }]}>Total Amount</Text>
            <Text style={[styles.summaryVal, { fontWeight: '800', color: Colors.primary, fontSize: 16 }]}>
              ₹{parseFloat(order.total_amount).toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={[styles.summaryRow, { borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 10, marginTop: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.summaryText}>Paid Amount</Text>
              <View style={[styles.miniBadge, { backgroundColor: payStyle.bg, marginLeft: 6 }]}>
                <Text style={[styles.miniBadgeText, { color: payStyle.text }]}>{order.payment_status}</Text>
              </View>
            </View>
            <Text style={styles.summaryVal}>₹{parseFloat(order.paid_amount).toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Payment Timeline Card */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>Payment Timeline</Text>
            {payments.length > 0 && (
              <TouchableOpacity
                onPress={handleDownloadStatement}
                disabled={downloadingStatement}
                style={styles.downloadStatementLink}
              >
                {downloadingStatement ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="document-text-outline" size={14} color={Colors.primary} />
                    <Text style={styles.downloadStatementLinkText}>Download Statement</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>

          {loadingPayments ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />
          ) : payments.length === 0 ? (
            <Text style={{ fontSize: 13, color: Colors.textMuted, fontStyle: 'italic', marginVertical: 4 }}>
              No payments recorded yet.
            </Text>
          ) : (
            <View style={styles.timelineContainer}>
              {payments.map((p, idx) => (
                <View key={p.id || idx} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={styles.timelineDot} />
                    {idx < payments.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>
                      Payment Received · ₹{Number(p.amount).toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.timelineSub}>
                      {formatDate(p.payment_date)} · {p.payment_method}
                    </Text>
                    {p.notes ? <Text style={styles.timelineNotes}>{p.notes}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Action Controls */}
        <View style={{ marginTop: 8 }}>
          {(order.status === 'ACTIVE' || order.status === 'OVERDUE') && (
            <TouchableOpacity style={styles.actionButtonMain} onPress={() => setShowReturnModal(true)}>
              <Ionicons name="enter-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.actionButtonMainText}>Record Return</Text>
            </TouchableOpacity>
          )}

          {order.payment_status !== 'PAID' && order.status !== 'CANCELLED' && (
            <TouchableOpacity
              style={[styles.actionButtonSecondary, { marginTop: 10 }]}
              onPress={() => router.push(`/rental-order/${id}/record-payment`)}
            >
              <Ionicons name="cash-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.actionButtonSecondaryText}>Mark Paid</Text>
            </TouchableOpacity>
          )}

          {parseFloat(order.late_fee_total) > 0 && order.status !== 'CANCELLED' && (
            <TouchableOpacity style={[styles.actionButtonSecondary, { marginTop: 10 }]} onPress={handleWaiveFee}>
              <Ionicons name="cut-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.actionButtonSecondaryText}>Waive Late Fees</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeScrollView>

      {/* Return Modal (Bottom Sheet style) */}
      <Modal visible={showReturnModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Return Flow</Text>
              <TouchableOpacity onPress={() => setShowReturnModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled" enableOnAndroid={true} extraScrollHeight={40}>
              <Text style={{ fontSize: 13, color: Colors.textSecondary, marginBottom: 12 }}>
                Distributes returned items across rented items. Remaining to be returned: <Text style={{ fontWeight: '700', color: Colors.primary }}>{remainingToReturn}</Text> units.
              </Text>

              {/* Quantity to return */}
              <View style={styles.fieldContainer}>
                <Text style={styles.modalLabel}>Quantity to Return *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={`Max ${remainingToReturn}`}
                  value={qtyToReturn}
                  onChangeText={setQtyToReturn}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              {/* Condition */}
              <View style={styles.fieldContainer}>
                <Text style={styles.modalLabel}>Asset Condition</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {CONDITION_OPTIONS.map((opt) => {
                    const isSelected = selectedCondition === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.gstChip, isSelected ? styles.gstChipActive : null]}
                        onPress={() => setSelectedCondition(opt.value)}
                      >
                        <Text style={[styles.gstChipText, isSelected ? styles.gstChipTextActive : null]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Conditional Damages */}
              {(selectedCondition === 'DAMAGED' || selectedCondition === 'WRITE_OFF') && (
                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 0.5, borderColor: Colors.border }}>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.modalLabel}>Damage Deduction Fee (₹)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="0.00"
                      value={damageDeduction}
                      onChangeText={setDamageDeduction}
                      keyboardType="numeric"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.modalLabel}>Damage Notes</Text>
                    <TextInput
                      style={[styles.modalInput, { height: 50, textAlignVertical: 'top' }]}
                      placeholder="Specify damages details..."
                      value={damageNotes}
                      onChangeText={setDamageNotes}
                      multiline
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>
              )}

              {/* Waive Fees Switch */}
              {order.days_overdue !== undefined && order.days_overdue > 0 && (
                <View style={[styles.switchRow, { marginBottom: 12 }]}>
                  <Text style={styles.modalLabel}>Waive Late Fees generated by this return</Text>
                  <Switch value={waiveLateFee} onValueChange={setWaiveLateFee} trackColor={{ true: Colors.primary }} />
                </View>
              )}

              {/* Mark as paid Switch */}
              {order.payment_status !== 'PAID' && (
                <View style={{ marginTop: 4 }}>
                  <View style={[styles.switchRow, { marginBottom: 12 }]}>
                    <Text style={styles.modalLabel}>Mark Order Payment as PAID</Text>
                    <Switch value={markAsPaid} onValueChange={setMarkAsPaid} trackColor={{ true: Colors.primary }} />
                  </View>

                  {markAsPaid && (
                    <View style={styles.fieldContainer}>
                      <Text style={styles.modalLabel}>Payment Method</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'].map((method) => {
                          const isSelected = paymentMethod === method;
                          return (
                            <TouchableOpacity
                              key={method}
                              style={[styles.gstChip, isSelected ? styles.gstChipActive : null]}
                              onPress={() => setPaymentMethod(method)}
                            >
                              <Text style={[styles.gstChipText, isSelected ? styles.gstChipTextActive : null]}>
                                {method.replace('_', ' ')}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.submitReturnBtn} onPress={handleRecordReturn} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitReturnBtnText}>Record Return & Free Assets</Text>
                )}
              </TouchableOpacity>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>


    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  header: { backgroundColor: Colors.card, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7ED', borderWidth: 0.5, borderColor: '#FED7AA' },

  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontWeight: '600' },
  miniBadge: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: '#F1F5F9' },
  miniBadgeText: { fontSize: 8, fontWeight: '600', color: Colors.textSecondary },

  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: Colors.border },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  customerName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', marginBottom: 4 },
  fieldLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  fieldValue: { fontSize: 13, color: Colors.text, fontWeight: '600' },

  itemRow: { paddingVertical: 10 },
  itemBorder: { borderTopWidth: 0.5, borderTopColor: Colors.border },
  itemName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  itemPrice: { fontSize: 13, fontWeight: '700', color: Colors.text },
  assetsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#F8FAFC', padding: 6, borderRadius: 6, borderWidth: 0.5, borderColor: Colors.border },
  assetChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#FFF7ED', borderWidth: 0.5, borderColor: '#FED7AA' },
  assetChipText: { fontSize: 9, fontWeight: '700', color: Colors.primary },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryText: { fontSize: 12, color: Colors.textSecondary },
  summaryVal: { fontSize: 13, color: Colors.text, fontWeight: '600' },

  actionButtonMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, elevation: 2, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  actionButtonMainText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  actionButtonSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7ED', borderRadius: 10, paddingVertical: 11, borderWidth: 1, borderColor: '#FED7AA' },
  actionButtonSecondaryText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  modalLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  modalInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: Colors.text, backgroundColor: '#FAFBFD' },
  fieldContainer: { marginBottom: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  gstChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#FFF7ED', borderWidth: 0.5, borderColor: '#FED7AA' },
  gstChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  gstChipText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  gstChipTextActive: { color: '#fff' },

  submitReturnBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  submitReturnBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  outstandingBox: { backgroundColor: '#FFFBEB', borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A', alignItems: 'center' },
  outstandingLabel: { fontSize: 11, fontWeight: '700', color: '#B45309', textTransform: 'uppercase', letterSpacing: 0.5 },
  outstandingValue: { fontSize: 20, fontWeight: '800', color: '#D97706', marginTop: 2 },
  dateSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FAFBFD' },
  dateSelectorText: { fontSize: 13, color: Colors.text, fontWeight: '500' },

  downloadStatementLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  downloadStatementLinkText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  timelineContainer: { marginTop: 4 },
  timelineRow: { flexDirection: 'row', minHeight: 45 },
  timelineLeft: { alignItems: 'center', marginRight: 10, width: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  timelineContent: { flex: 1, paddingBottom: 12 },
  timelineTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
  timelineSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  timelineNotes: { fontSize: 11, color: '#F97316', fontWeight: '500', marginTop: 2, fontStyle: 'italic' },
});
