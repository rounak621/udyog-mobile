import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import DateRangePicker from '../../components/DateRangePicker';
import { getApiErrorMessage } from '../../utils/apiError';

interface PaymentModeBreakdown {
  mode: string;
  total_amount: number;
  count: number;
}

interface PaymentReportItem {
  id: string;
  payment_date: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  mode: string;
  invoice_number?: string | null;
  notes?: string | null;
}

interface PaymentReportData {
  pending_total: number;
  received_total: number;
  received_by_mode: PaymentModeBreakdown[];
  payments: PaymentReportItem[];
}

type FilterPreset = 'monthly' | 'last60' | 'last90' | 'custom';

const formatCurrency = (amt: number): string => {
  return '₹' + Number(amt || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDateToISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const generateRecentMonths = () => {
  const list = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mName = d.toLocaleString('en-IN', { month: 'short' });
    const year = d.getFullYear();
    const monthNum = d.getMonth() + 1;
    const lastDay = new Date(year, monthNum, 0).getDate();
    list.push({
      label: `${mName} ${year}`,
      startDate: `${year}-${String(monthNum).padStart(2, '0')}-01`,
      endDate: `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    });
  }
  return list;
};

const getModeColor = (mode: string) => {
  switch ((mode || '').toUpperCase()) {
    case 'UPI':
      return { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' };
    case 'BANK':
      return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
    case 'CASH':
      return { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' };
    case 'CHEQUE':
      return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' };
    default:
      return { bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF' };
  }
};

const getModeIconName = (mode: string): any => {
  switch ((mode || '').toUpperCase()) {
    case 'UPI':
      return 'phone-portrait-outline';
    case 'BANK':
      return 'business-outline';
    case 'CASH':
      return 'cash-outline';
    case 'CHEQUE':
      return 'document-text-outline';
    default:
      return 'wallet-outline';
  }
};

export default function PaymentReportScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recentMonths = useMemo(() => generateRecentMonths(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<PaymentReportData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<FilterPreset>('monthly');
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  // Hardware back button support
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.back();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
  );

  // Compute start and end dates
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const today = new Date();
    if (filterType === 'monthly') {
      const cur = recentMonths[selectedMonthIdx] || recentMonths[0];
      return {
        startDate: cur.startDate,
        endDate: cur.endDate,
        periodLabel: cur.label,
      };
    } else if (filterType === 'last60') {
      const past = new Date(today);
      past.setDate(past.getDate() - 60);
      return {
        startDate: formatDateToISO(past),
        endDate: formatDateToISO(today),
        periodLabel: 'Last 60 Days',
      };
    } else if (filterType === 'last90') {
      const past = new Date(today);
      past.setDate(past.getDate() - 90);
      return {
        startDate: formatDateToISO(past),
        endDate: formatDateToISO(today),
        periodLabel: 'Last 90 Days',
      };
    } else {
      const s = customStart || recentMonths[0].startDate;
      const e = customEnd || recentMonths[0].endDate;
      return {
        startDate: s,
        endDate: e,
        periodLabel: `${formatDisplayDate(s)} - ${formatDisplayDate(e)}`,
      };
    }
  }, [filterType, selectedMonthIdx, customStart, customEnd, recentMonths]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getToken();
      setAuthToken(token);

      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;

      const res = await api.get('/reports/payments', {
        params: {
          business_id: bId,
          start_date: startDate,
          end_date: endDate,
        },
      });

      setData(res.data);
    } catch (err) {
      console.log('Payment report error:', err);
      setErrorMsg(getApiErrorMessage(err, 'Failed to load payment report'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, startDate, endDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    if (!data?.payments) return [];
    if (!selectedMode) return data.payments;
    return data.payments.filter(
      p => (p.mode || '').toUpperCase() === selectedMode.toUpperCase()
    );
  }, [data, selectedMode]);

  const activeModes = useMemo(() => {
    if (!data?.received_by_mode) return [];
    return data.received_by_mode.filter(m => m.count > 0 || m.total_amount > 0);
  }, [data]);

  const receivedTotal = useMemo(() => {
    if (!data) return 0;
    if (typeof data.received_total === 'number') return data.received_total;
    return data.received_by_mode.reduce((acc, m) => acc + (m.total_amount || 0), 0);
  }, [data]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Top Header */}
      <View style={[styles.topbar, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topbarTitle}>Payment Report</Text>
          <Text style={styles.topbarSubtitle}>{periodLabel}</Text>
        </View>
      </View>

      <FlatList
        data={filteredPayments}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 30 }]}
        ListHeaderComponent={
          <View>
            {/* Filter Presets Tabs */}
            <View style={styles.presetTabs}>
              {(['monthly', 'last60', 'last90', 'custom'] as FilterPreset[]).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.presetTab, filterType === type && styles.presetTabActive]}
                  onPress={() => setFilterType(type)}
                >
                  <Text
                    style={[
                      styles.presetTabText,
                      filterType === type && styles.presetTabTextActive,
                    ]}
                  >
                    {type === 'monthly'
                      ? 'Monthly'
                      : type === 'last60'
                      ? 'Last 60D'
                      : type === 'last90'
                      ? 'Last 90D'
                      : 'Custom'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sub-filter: Monthly Carousel */}
            {filterType === 'monthly' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.monthsScroll}
              >
                {recentMonths.map((m, idx) => (
                  <TouchableOpacity
                    key={m.label}
                    style={[
                      styles.monthChip,
                      selectedMonthIdx === idx && styles.monthChipActive,
                    ]}
                    onPress={() => setSelectedMonthIdx(idx)}
                  >
                    <Text
                      style={[
                        styles.monthChipText,
                        selectedMonthIdx === idx && styles.monthChipTextActive,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Sub-filter: Custom Date Range */}
            {filterType === 'custom' && (
              <View style={styles.customDateWrapper}>
                <DateRangePicker
                  startDate={customStart || recentMonths[0].startDate}
                  endDate={customEnd || recentMonths[0].endDate}
                  onApply={(s, e) => {
                    setCustomStart(s);
                    setCustomEnd(e);
                  }}
                />
              </View>
            )}

            {/* Error Message */}
            {errorMsg && (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={18} color={Colors.danger} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Loading Indicator */}
            {loading && !refreshing && (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Fetching payment statistics...</Text>
              </View>
            )}

            {/* KPI Cards */}
            {!loading && (
              <>
                {/* 1. Total Pending Card (Tapping navigates to Receivables in Bills tab) */}
                <TouchableOpacity
                  style={styles.pendingCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    router.push('/(tabs)/bills?initialFilter=Receivables' as any);
                  }}
                >
                  <View style={styles.pendingLeft}>
                    <View style={styles.pendingIconWrap}>
                      <Ionicons name="time-outline" size={22} color="#DC2626" />
                    </View>
                    <View>
                      <Text style={styles.pendingLabel}>TOTAL PENDING AMOUNT</Text>
                      <Text style={styles.pendingValue}>
                        {formatCurrency(data?.pending_total || 0)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Unpaid dues →</Text>
                  </View>
                </TouchableOpacity>

                {/* 2. Total Received Card */}
                <View style={styles.receivedCard}>
                  <View style={styles.receivedTop}>
                    <View>
                      <Text style={styles.receivedLabel}>TOTAL RECEIVED</Text>
                      <Text style={styles.receivedValue}>
                        {formatCurrency(receivedTotal)}
                      </Text>
                    </View>
                    <View style={styles.receivedIconWrap}>
                      <Ionicons name="checkmark-done-circle-outline" size={24} color="#059669" />
                    </View>
                  </View>

                  {/* Mode Breakdown Filter Chips */}
                  <Text style={styles.breakdownHeader}>Breakdown by Payment Mode</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.modeChipsRow}
                  >
                    <TouchableOpacity
                      style={[
                        styles.modeFilterChip,
                        selectedMode === null && styles.modeFilterChipActive,
                      ]}
                      onPress={() => setSelectedMode(null)}
                    >
                      <Text
                        style={[
                          styles.modeFilterChipTitle,
                          selectedMode === null && styles.modeFilterChipTitleActive,
                        ]}
                      >
                        All Modes ({data?.payments?.length || 0})
                      </Text>
                      <Text
                        style={[
                          styles.modeFilterChipAmount,
                          selectedMode === null && styles.modeFilterChipAmountActive,
                        ]}
                      >
                        {formatCurrency(receivedTotal)}
                      </Text>
                    </TouchableOpacity>

                    {activeModes.map(m => {
                      const isSelected =
                        selectedMode?.toUpperCase() === m.mode.toUpperCase();
                      const colors = getModeColor(m.mode);
                      return (
                        <TouchableOpacity
                          key={m.mode}
                          style={[
                            styles.modeFilterChip,
                            isSelected && {
                              borderColor: colors.text,
                              backgroundColor: colors.bg,
                            },
                          ]}
                          onPress={() =>
                            setSelectedMode(isSelected ? null : m.mode)
                          }
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons
                              name={getModeIconName(m.mode)}
                              size={14}
                              color={isSelected ? colors.text : Colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.modeFilterChipTitle,
                                isSelected && { color: colors.text, fontWeight: '700' },
                              ]}
                            >
                              {m.mode} ({m.count})
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.modeFilterChipAmount,
                              isSelected && { color: colors.text, fontWeight: '800' },
                            ]}
                          >
                            {formatCurrency(m.total_amount)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Section Title for Drill-down Payments */}
                <View style={styles.drilldownHeaderRow}>
                  <Text style={styles.drilldownTitle}>
                    {selectedMode
                      ? `${selectedMode} Transactions (${filteredPayments.length})`
                      : `All Transactions (${filteredPayments.length})`}
                  </Text>
                  {selectedMode && (
                    <TouchableOpacity onPress={() => setSelectedMode(null)}>
                      <Text style={styles.clearFilterText}>Show All</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const colors = getModeColor(item.mode);
          return (
            <View style={styles.paymentCard}>
              <View style={styles.paymentCardTop}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.paymentCustomerName} numberOfLines={1}>
                    {item.customer_name}
                  </Text>
                  <Text style={styles.paymentDate}>
                    {formatDisplayDate(item.payment_date)}
                    {item.invoice_number ? ` · Inv: #${item.invoice_number}` : ' · Unallocated'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.paymentAmount}>
                    {formatCurrency(item.amount)}
                  </Text>
                  <View
                    style={[
                      styles.modeBadge,
                      { backgroundColor: colors.bg, borderColor: colors.border },
                    ]}
                  >
                    <Ionicons name={getModeIconName(item.mode)} size={11} color={colors.text} />
                    <Text style={[styles.modeBadgeText, { color: colors.text }]}>
                      {item.mode}
                    </Text>
                  </View>
                </View>
              </View>

              {item.notes ? (
                <View style={styles.paymentNotesBox}>
                  <Ionicons name="chatbubble-ellipses-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.paymentNotesText} numberOfLines={2}>
                    {item.notes}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Payments Found</Text>
              <Text style={styles.emptySubtitle}>
                No payment transactions recorded for the selected period and mode.
              </Text>
            </View>
          ) : null
        }
      />
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
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  topbarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  topbarSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  listContainer: {
    padding: 16,
  },
  presetTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.md,
    padding: 3,
    marginBottom: 12,
  },
  presetTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  presetTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  presetTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  presetTabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  monthsScroll: {
    paddingBottom: 12,
    gap: 8,
  },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: Colors.primary,
  },
  monthChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  monthChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  customDateWrapper: {
    marginBottom: 12,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: Radius.md,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    flex: 1,
  },
  centerLoading: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  pendingCard: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderLeftWidth: 5,
    borderLeftColor: '#EF4444',
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  pendingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pendingIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  pendingValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#DC2626',
  },
  pendingBadge: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  receivedCard: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  receivedTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  receivedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  receivedValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#059669',
  },
  receivedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  modeChipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  modeFilterChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
  },
  modeFilterChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: Colors.primary,
  },
  modeFilterChipTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  modeFilterChipTitleActive: {
    color: Colors.primary,
  },
  modeFilterChipAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  modeFilterChipAmountActive: {
    color: Colors.primary,
  },
  drilldownHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  drilldownTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 8,
  },
  paymentCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paymentCustomerName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  paymentDate: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 4,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  paymentNotesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#F1F5F9',
  },
  paymentNotesText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
