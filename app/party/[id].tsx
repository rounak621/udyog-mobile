import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@clerk/clerk-expo';
import { SafeScrollView } from '../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken, API_BASE_URL } from '../../services/api';
import { showApiError } from '../../utils/apiError';
import * as FileSystem from 'expo-file-system/legacy';
import { savePdfToAndroidOrShare } from '../../services/safHelper';
import { getApiErrorMessage } from '../../utils/apiError';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function PartyDetailScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  
  const [party, setParty] = useState<any>(null);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Advance Balance State
  const [advanceBalance, setAdvanceBalance] = useState<{
    available_advance: number;
    total_advance_received: number;
    total_advance_applied: number;
    total_advance_refunded: number;
  }>({
    available_advance: 0,
    total_advance_received: 0,
    total_advance_applied: 0,
    total_advance_refunded: 0,
  });

  // Modals State
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);

  // Receive Advance Form State
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [advanceMode, setAdvanceMode] = useState<'BANK' | 'UPI' | 'CASH' | 'CHEQUE' | 'OTHER'>('BANK');
  const [advanceNotes, setAdvanceNotes] = useState('');
  const [submittingAdvance, setSubmittingAdvance] = useState(false);

  // Refund Advance Form State
  const [refundAmount, setRefundAmount] = useState('');
  const [refundDate, setRefundDate] = useState(new Date().toISOString().split('T')[0]);
  const [refundMode, setRefundMode] = useState<'BANK' | 'UPI' | 'CASH' | 'CHEQUE' | 'OTHER'>('BANK');
  const [refundNotes, setRefundNotes] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'khata' | 'bills'>('khata');

  useEffect(() => {
    if (tab === 'bills' || tab === 'khata') {
      setActiveTab(tab);
    }
  }, [tab]);

  const [ledgerLines, setLedgerLines] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
  const [downloadingKhata, setDownloadingKhata] = useState(false);

  const handleDownloadKhata = async () => {
    if (!party || downloadingKhata) return;
    setDownloadingKhata(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;

      const safeName = (party.name || 'Party').replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `${safeName}_Khata_${dateStr}.pdf`;

      const pdfUrl = `${API_BASE_URL}/customers/${id}/ledger/pdf?business_id=${bId}`;
      const fileUri = (FileSystem as any).cacheDirectory + fileName;

      const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (downloadResult.status === 200) {
        await savePdfToAndroidOrShare(downloadResult.uri, fileName, `Khata ${party.name}`, 'Statements');
      } else {
        throw new Error('Download failed');
      }
    } catch (err) {
      console.log('Khata PDF download error:', err);
      showApiError(err, 'Could not download Khata PDF');
    } finally {
      setDownloadingKhata(false);
    }
  };

  const loadLedger = useCallback(async () => {
    if (ledgerLoading) return;
    setLedgerLoading(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      
      const ledgerRes = await api.get(`/ledger/party/${id}?business_id=${bId}`);
      setLedgerLines(ledgerRes.data.statement || []);
      setLedgerLoaded(true);
    } catch (err) {
      console.log('Failed to load ledger', err);
      showApiError(err, 'Failed to load ledger');
    } finally {
      setLedgerLoading(false);
    }
  }, [id, getToken, ledgerLoading]);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      
      const partyRes = await api.get(`/customers/${id}?business_id=${bId}`);
      const partyData = partyRes.data;
      setParty(partyData);

      const pt = String(partyData?.party_type || 'customer').toLowerCase();
      const isSupplier = pt === 'supplier' || pt === 'both';

      const [invRes, pbRes, rentalRes, advRes] = await Promise.allSettled([
        api.get(`/invoices/?business_id=${bId}&customer_id=${id}&limit=1000&skip=0`),
        isSupplier ? api.get(`/purchase-bills/?business_id=${bId}&supplier_id=${id}`) : Promise.resolve({ data: [] }),
        api.get(`/rental-orders/?business_id=${bId}&customer_id=${id}`),
        api.get(`/payments/customer/${id}/advance-balance?business_id=${bId}`),
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

      let rentalList: any[] = [];
      if (rentalRes.status === 'fulfilled') {
        const rentalData = rentalRes.value.data;
        rentalList = Array.isArray(rentalData) ? rentalData : Array.isArray(rentalData?.items) ? rentalData.items : Array.isArray(rentalData?.orders) ? rentalData.orders : [];
      }

      if (advRes.status === 'fulfilled') {
        const advData = (advRes.value as any)?.data;
        if (advData) {
          setAdvanceBalance({
            available_advance: Number(advData.available_advance || 0),
            total_advance_received: Number(advData.total_advance_received || 0),
            total_advance_applied: Number(advData.total_advance_applied || 0),
            total_advance_refunded: Number(advData.total_advance_refunded || 0),
          });
        }
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
        })),
        ...rentalList.map((order: any) => ({
          id: order.id,
          date: order.invoice_date || order.start_date || order.created_at,
          billNumber: order.order_number || '—',
          amount: Number(order.total_amount || 0),
          paidAmount: Number(order.paid_amount || 0),
          type: 'RENTAL',
          status: order.payment_status || 'UNPAID',
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setBills(combined);

      if (activeTab === 'khata') {
        const ledgerRes = await api.get(`/ledger/party/${id}?business_id=${bId}`);
        setLedgerLines(ledgerRes.data.statement || []);
        setLedgerLoaded(true);
      }
    } catch (err) {
      console.log('Party detail error:', err);
      showApiError(err, 'Failed to load party details');
    } finally {
      setLoading(false);
    }
  }, [id, getToken, activeTab]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Lazy load ledger when switching to khata tab
  useEffect(() => {
    if (activeTab === 'khata' && !ledgerLoaded && party) {
      loadLedger();
    }
  }, [activeTab, ledgerLoaded, party, loadLedger]);

  const handleEdit = () => {
    router.push(`/party/create?id=${id}`);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Party?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              setAuthToken(token);
              const bizRes = await api.get('/businesses/me');
              const bId = bizRes.data.id;
              await api.delete(`/customers/${id}?business_id=${bId}`);
              Alert.alert('Deleted', 'Party deleted successfully.');
              router.back();
            } catch (err: any) {
              if (err.response?.status === 409) {
                const errMsg = getApiErrorMessage(err, 'Cannot delete party: active invoices or purchase bills exist.');
                Alert.alert('Cannot Delete', errMsg);
              } else {
                Alert.alert('Error', 'Failed to delete party. Please try again.');
              }
            }
          }
        }
      ]
    );
  };

  const handleReceiveAdvance = async () => {
    const numAmount = parseFloat(advanceAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive amount.');
      return;
    }
    setSubmittingAdvance(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      await api.post(`/payments/receive-advance?business_id=${bId}`, {
        party_id: id,
        payment_date: advanceDate,
        amount: numAmount,
        payment_mode: advanceMode,
        notes: advanceNotes.trim() || null,
      });
      setIsAdvanceModalOpen(false);
      setAdvanceAmount('');
      setAdvanceNotes('');
      Alert.alert('Success', 'Advance payment recorded successfully.');
      load();
    } catch (err: any) {
      Alert.alert('Error', getApiErrorMessage(err, 'Failed to record advance payment.'));
    } finally {
      setSubmittingAdvance(false);
    }
  };

  const handleRefundAdvance = async () => {
    const numAmount = parseFloat(refundAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive amount.');
      return;
    }
    if (numAmount > advanceBalance.available_advance + 0.01) {
      Alert.alert('Limit Exceeded', `Refund amount cannot exceed available advance (₹${advanceBalance.available_advance.toFixed(2)}).`);
      return;
    }
    setSubmittingRefund(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      await api.post(`/payments/refund-advance?business_id=${bId}`, {
        party_id: id,
        refund_date: refundDate,
        amount: numAmount,
        payment_mode: refundMode,
        notes: refundNotes.trim() || null,
      });
      setIsRefundModalOpen(false);
      setRefundAmount('');
      setRefundNotes('');
      Alert.alert('Success', 'Advance refund recorded successfully.');
      load();
    } catch (err: any) {
      Alert.alert('Error', getApiErrorMessage(err, 'Failed to record refund.'));
    } finally {
      setSubmittingRefund(false);
    }
  };

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity onPress={handleDownloadKhata} disabled={downloadingKhata} style={{ padding: 2 }}>
            {downloadingKhata ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="document-text-outline" size={22} color={Colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleEdit} style={{ padding: 2 }}>
            <Ionicons name="pencil-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={{ padding: 2 }}>
            <Ionicons name="trash-outline" size={22} color={Colors.danger} />
          </TouchableOpacity>
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
      </View>

      <SafeScrollView baseBottomPadding={40} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        {/* Advance Actions & Banner */}
        {(() => {
          const pt = String(party.party_type || 'customer').toLowerCase();
          const canReceiveAdvance = pt !== 'supplier';
          const hasAdvance = advanceBalance.available_advance > 0;

          if (!canReceiveAdvance && !hasAdvance) return null;

          return (
            <View style={{ gap: 10 }}>
              {/* Advance Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {canReceiveAdvance && (
                  <TouchableOpacity
                    style={[styles.advanceActionBtn, { flex: 1 }]}
                    onPress={() => {
                      setAdvanceAmount('');
                      setAdvanceDate(new Date().toISOString().split('T')[0]);
                      setAdvanceMode('BANK');
                      setAdvanceNotes('');
                      setIsAdvanceModalOpen(true);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={17} color="#c2410c" />
                    <Text style={styles.advanceActionBtnText}>Receive Advance</Text>
                  </TouchableOpacity>
                )}
                {hasAdvance && (
                  <TouchableOpacity
                    style={[styles.advanceActionBtn, { flex: 1, backgroundColor: '#fff', borderColor: '#fed7aa' }]}
                    onPress={() => {
                      setRefundAmount(advanceBalance.available_advance.toFixed(2));
                      setRefundDate(new Date().toISOString().split('T')[0]);
                      setRefundMode('BANK');
                      setRefundNotes('');
                      setIsRefundModalOpen(true);
                    }}
                  >
                    <Ionicons name="arrow-undo-outline" size={17} color="#c2410c" />
                    <Text style={styles.advanceActionBtnText}>Refund Advance</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Advance Available Banner (matches web PartyDetail) */}
              {hasAdvance && (
                <View style={styles.advanceBannerCard}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.advanceIconWrap}>
                      <Ionicons name="wallet" size={18} color="#EA580C" />
                    </View>
                    <View>
                      <Text style={styles.advanceBannerLabel}>Advance Available</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
                        <Text style={styles.advanceBannerValue}>{fmt(advanceBalance.available_advance)}</Text>
                        <View style={styles.crPill}>
                          <Text style={styles.crPillText}>CR</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.refundBtnSmall}
                    onPress={() => {
                      setRefundAmount(advanceBalance.available_advance.toFixed(2));
                      setRefundDate(new Date().toISOString().split('T')[0]);
                      setRefundMode('BANK');
                      setRefundNotes('');
                      setIsRefundModalOpen(true);
                    }}
                  >
                    <Text style={styles.refundBtnSmallText}>Refund</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })()}

        {/* Details Card */}
        <View style={styles.card}>
          {[
            { icon: 'call-outline', label: 'Phone', value: party.phone || '—' },
            { icon: 'mail-outline', label: 'Email', value: party.email || '—' },
            { icon: 'card-outline', label: 'GSTIN', value: party.gstin || '—' },
            { icon: 'location-outline', label: 'State', value: party.state || '—' },
            ...(party.address ? [{ icon: 'home-outline', label: 'Billing Address', value: party.address }] : []),
            ...(party.consignment_address ? [{ icon: 'airplane-outline', label: 'Shipping Address', value: party.consignment_address }] : []),
          ].map((item, idx, arr) => (
            <View 
              key={item.label} 
              style={[
                styles.detailRow, 
                idx === arr.length - 1 && { borderBottomWidth: 0 }
              ]}
            >
              <Ionicons name={item.icon as any} size={16} color={Colors.textMuted} />
              <Text style={styles.detailLabel} textBreakStrategy="simple">{item.label}</Text>
              <Text style={styles.detailValue} textBreakStrategy="simple">{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Outstanding Balance Summary Card */}
        {(() => {
          const totalSalesInvoiced = bills.filter(b => b.type === 'INVOICE' || b.type === 'RENTAL').reduce((s, b) => s + b.amount, 0);
          const totalSalesPaid = bills.filter(b => b.type === 'INVOICE' || b.type === 'RENTAL').reduce((s, b) => s + b.paidAmount, 0);
          
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

        {/* Tab Segmented Control */}
        <View style={styles.tabRow}>
          {[
            { key: 'khata', label: 'Khata (Ledger)', icon: 'book-outline' },
            { key: 'bills', label: 'Bills', icon: 'receipt-outline' }
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
              onPress={() => setActiveTab(t.key as any)}
            >
              <Ionicons name={t.icon as any} size={15} color={activeTab === t.key ? '#fff' : '#64748B'} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === t.key && styles.tabBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Contents */}
        {activeTab === 'khata' ? (
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity
                onPress={handleDownloadKhata}
                disabled={downloadingKhata}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' }}
              >
                {downloadingKhata ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={15} color={Colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>Khata PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {ledgerLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
            ) : ledgerLines.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No transactions found.</Text>
              </View>
            ) : (
              ledgerLines.map((line, idx) => {
                const isDebit = Number(line.debit) > 0;
                const amount = isDebit ? line.debit : line.credit;
                return (
                  <View key={idx} style={styles.ledgerCard}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.ledgerParticulars}>{line.narration || 'Transaction'}</Text>
                      <Text style={styles.ledgerDate}>
                        {line.transaction_date ? new Date(line.transaction_date).toLocaleDateString('en-IN') : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={[styles.ledgerAmount, isDebit ? styles.debitText : styles.creditText]}>
                        {isDebit ? '-' : '+'}{fmt(Number(amount))}
                      </Text>
                      <Text style={styles.ledgerBalance}>
                        Bal: {fmt(Number(line.running_balance))} {line.balance_type}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Bills</Text>
            {bills.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No bills found</Text>
              </View>
            ) : (
              bills.map(bill => {
                const ps = (bill.status || 'UNPAID').toUpperCase();
                const isPaid = ps === 'PAID';
                const isPartial = ps === 'PARTIAL';
                
                let typeLabel = 'Sale';
                let typeBg = '#EFF6FF';
                let typeColor = '#1D4ED8';
                let navigatePath = `/invoice/${bill.id}`;
                
                if (bill.type === 'RENTAL') {
                  typeLabel = 'Rental';
                  typeBg = '#F0FDF4';
                  typeColor = '#166534';
                  navigatePath = `/rental-order/${bill.id}`;
                } else if (bill.type === 'PURCHASE') {
                  typeLabel = 'Purchase';
                  typeBg = '#FAF5FF';
                  typeColor = '#6B21A8';
                  navigatePath = `/purchase-bills/${bill.id}`;
                }
                
                return (
                  <TouchableOpacity 
                    key={`${bill.type}_${bill.id}`} 
                    style={styles.invCard} 
                    onPress={() => {
                      // Navigate to the specific detail screen depending on the bill type:
                      // INVOICE -> /invoice/[id]
                      // RENTAL -> /rental-order/[id]
                      // PURCHASE -> /purchase-bills/[id]
                      router.push(navigatePath as any);
                    }}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.invNum}>{bill.billNumber}</Text>
                        <View style={{
                          paddingHorizontal: 6,
                          paddingVertical: 1.5,
                          borderRadius: 10,
                          backgroundColor: typeBg,
                        }}>
                          <Text style={{
                            fontSize: 9,
                            fontWeight: '700',
                            color: typeColor,
                          }}>
                            {typeLabel}
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
              })
            )}
          </View>
        )}
      </SafeScrollView>

      {/* Receive Advance Modal */}
      <Modal
        visible={isAdvanceModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAdvanceModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Receive Advance</Text>
                <Text style={styles.modalSubtitle}>Party: <Text style={{ fontWeight: '700', color: Colors.text }}>{party?.name}</Text></Text>
              </View>
              <TouchableOpacity onPress={() => setIsAdvanceModalOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Advance Amount */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Advance Amount *</Text>
                <View style={styles.currencyInputWrap}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    style={styles.currencyInput}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={advanceAmount}
                    onChangeText={setAdvanceAmount}
                  />
                </View>
              </View>

              {/* Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date *</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={advanceDate}
                  onChangeText={setAdvanceDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              {/* Payment Mode */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Payment Mode *</Text>
                <View style={styles.modeRow}>
                  {([
                    { key: 'BANK', label: 'Bank Transfer' },
                    { key: 'UPI', label: 'UPI' },
                    { key: 'CASH', label: 'Cash' },
                    { key: 'CHEQUE', label: 'Cheque' },
                    { key: 'OTHER', label: 'Other' },
                  ] as const).map(m => (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.modeChip, advanceMode === m.key && styles.modeChipActive]}
                      onPress={() => setAdvanceMode(m.key)}
                    >
                      <Text style={[styles.modeChipText, advanceMode === m.key && styles.modeChipTextActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Notes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.modalTextInput, { height: 70, textAlignVertical: 'top' }]}
                  multiline
                  value={advanceNotes}
                  onChangeText={setAdvanceNotes}
                  placeholder="e.g. Upfront advance for upcoming construction deliveries"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsAdvanceModalOpen(false)}
                  disabled={submittingAdvance}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, submittingAdvance && { opacity: 0.6 }]}
                  onPress={handleReceiveAdvance}
                  disabled={submittingAdvance}
                >
                  {submittingAdvance ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Receive Advance</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Refund Advance Modal */}
      <Modal
        visible={isRefundModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsRefundModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Refund Advance</Text>
                <Text style={styles.modalSubtitle}>Party: <Text style={{ fontWeight: '700', color: Colors.text }}>{party?.name}</Text></Text>
              </View>
              <TouchableOpacity onPress={() => setIsRefundModalOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Available Advance Info Box */}
              <View style={styles.modalInfoBox}>
                <Text style={styles.modalInfoLabel}>AVAILABLE ADVANCE</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={styles.modalInfoVal}>{fmt(advanceBalance.available_advance)}</Text>
                  <TouchableOpacity
                    onPress={() => setRefundAmount(advanceBalance.available_advance.toFixed(2))}
                    style={{ paddingVertical: 2, paddingHorizontal: 6 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#ea580c', textDecorationLine: 'underline' }}>Max</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Refund Amount */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount to Refund *</Text>
                <View style={styles.currencyInputWrap}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    style={styles.currencyInput}
                    placeholder={advanceBalance.available_advance.toFixed(2)}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={refundAmount}
                    onChangeText={setRefundAmount}
                  />
                </View>
              </View>

              {/* Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Refund Date *</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={refundDate}
                  onChangeText={setRefundDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              {/* Payment Mode */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Refund Mode *</Text>
                <View style={styles.modeRow}>
                  {([
                    { key: 'BANK', label: 'Bank Transfer' },
                    { key: 'UPI', label: 'UPI' },
                    { key: 'CASH', label: 'Cash' },
                    { key: 'CHEQUE', label: 'Cheque' },
                    { key: 'OTHER', label: 'Other' },
                  ] as const).map(m => (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.modeChip, refundMode === m.key && styles.modeChipActive]}
                      onPress={() => setRefundMode(m.key)}
                    >
                      <Text style={[styles.modeChipText, refundMode === m.key && styles.modeChipTextActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Notes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.modalTextInput, { height: 70, textAlignVertical: 'top' }]}
                  multiline
                  value={refundNotes}
                  onChangeText={setRefundNotes}
                  placeholder="Reason for refund (e.g. Unused advance returned to customer)"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsRefundModalOpen(false)}
                  disabled={submittingRefund}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, submittingRefund && { opacity: 0.6 }]}
                  onPress={handleRefundAdvance}
                  disabled={submittingRefund}
                >
                  {submittingRefund ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Confirm Refund</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  detailLabel: { fontSize: 13, color: Colors.textSecondary, width: 110, flexShrink: 0 },
  detailValue: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: '500' },
  balanceCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center' },
  balanceLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  balanceValue: { fontSize: 28, fontWeight: '800', letterSpacing: -1, marginBottom: 14 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  balanceCol: { flex: 1, alignItems: 'center' },
  balanceDivider: { width: 0.5, alignSelf: 'stretch', backgroundColor: Colors.border, marginHorizontal: 8 },
  balanceSubLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  balanceSubVal: { fontSize: 14, fontWeight: '700', color: Colors.text },
  receivableZero: { color: Colors.success },
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
  partialBadge: { backgroundColor: '#EFF6FF' },
  badgeText: { fontSize: 9, fontWeight: '600' },
  paidText: { color: Colors.success },
  unpaidText: { color: '#ea580c' },
  partialText: { color: '#2563EB' },
  // Tab control styles
  tabRow: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 10, padding: 4, marginVertical: 8 },
  tabBtn: { flex: 1, flexDirection: 'row', paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabBtnActive: { backgroundColor: '#F97316', shadowColor: '#F97316', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabBtnTextActive: { color: '#fff' },
  // Ledger styles
  ledgerCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  ledgerParticulars: { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1, flexWrap: 'wrap' },
  ledgerDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  ledgerAmount: { fontSize: 13, fontWeight: '700' },
  debitText: { color: '#DC2626' },
  creditText: { color: '#16A34A' },
  ledgerBalance: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },

  // Advance action buttons & banner
  advanceActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: '#FED7AA', backgroundColor: '#FFF7ED' },
  advanceActionBtnText: { fontSize: 13, fontWeight: '700', color: '#C2410C' },
  advanceBannerCard: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  advanceIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center' },
  advanceBannerLabel: { fontSize: 11, fontWeight: '600', color: '#9A3412', textTransform: 'uppercase', letterSpacing: 0.5 },
  advanceBannerValue: { fontSize: 18, fontWeight: '800', color: '#EA580C' },
  crPill: { backgroundColor: '#FFEDD5', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 },
  crPillText: { fontSize: 10, fontWeight: '700', color: '#9A3412' },
  refundBtnSmall: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#FED7AA', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.sm },
  refundBtnSmallText: { fontSize: 12, fontWeight: '700', color: '#C2410C' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  modalSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  modalInfoBox: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: Radius.sm, padding: 12, marginBottom: 14 },
  modalInfoLabel: { fontSize: 10, fontWeight: '700', color: '#9A3412', letterSpacing: 0.5 },
  modalInfoVal: { fontSize: 18, fontWeight: '800', color: '#EA580C' },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  currencyInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: '#f8fafc', paddingHorizontal: 12 },
  currencyPrefix: { fontSize: 15, fontWeight: '600', color: Colors.textMuted, marginRight: 6 },
  currencyInput: { flex: 1, height: 44, fontSize: 15, color: Colors.text, fontWeight: '600' },
  modalTextInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#f8fafc' },
  modeChipActive: { borderColor: Colors.primary, backgroundColor: '#FFF7ED' },
  modeChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  modeChipTextActive: { color: Colors.primary, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
