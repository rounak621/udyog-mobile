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
  TextInput,
  Alert,
  BackHandler,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import DateRangePicker from '../../components/DateRangePicker';
import {
  expenseService,
  Expense,
  ExpenseCategorySummary,
  PaymentMode,
} from '../../services/expenseService';
import { getApiErrorMessage } from '../../utils/apiError';

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

const getModeBadgeStyle = (mode: string) => {
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

export default function ExpensesListScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recentMonths = useMemo(() => generateRecentMonths(), []);

  const [businessId, setBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'breakdown'>('all');

  // Filters
  const [filterType, setFilterType] = useState<FilterPreset>('monthly');
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [search, setSearch] = useState('');

  // Data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [breakdown, setBreakdown] = useState<ExpenseCategorySummary[]>([]);
  const [breakdownTotal, setBreakdownTotal] = useState<number>(0);

  // Hardware back
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

  // Compute dates
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
    try {
      const token = await getToken();
      setAuthToken(token);

      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      setBusinessId(bId);

      // Fetch expenses list and categories in parallel
      const [listRes, catRes, breakdownRes] = await Promise.all([
        expenseService.listExpenses(bId, {
          startDate,
          endDate,
          category: selectedCategory || undefined,
        }),
        expenseService.getCategories(bId),
        expenseService.getBreakdown(bId, {
          startDate,
          endDate,
        }),
      ]);

      setExpenses(listRes.items || []);
      setTotalAmount(Number(listRes.total_amount || 0));
      setTotalCount(listRes.total || 0);
      setCategories(catRes || []);
      setBreakdown(breakdownRes?.categories || []);
      setBreakdownTotal(Number(breakdownRes?.total_amount || 0));
    } catch (err) {
      console.log('Expenses load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, startDate, endDate, selectedCategory]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Client search filtering
  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase().trim();
    return expenses.filter(
      e =>
        e.category.toLowerCase().includes(q) ||
        (e.vendor_name || '').toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q) ||
        (e.vendor_gstin || '').toLowerCase().includes(q)
    );
  }, [expenses, search]);

  const handleDeleteExpense = (expense: Expense) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete this ₹${expense.amount} expense (${expense.category})? This will reverse any related ledger postings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!businessId) return;
            try {
              await expenseService.deleteExpense(businessId, expense.id);
              Alert.alert('Success', 'Expense deleted successfully.');
              loadData();
            } catch (err) {
              Alert.alert('Error', getApiErrorMessage(err, 'Failed to delete expense.'));
            }
          },
        },
      ]
    );
  };

  const handleOpenReceipt = async (url?: string | null) => {
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('Error', 'Could not open receipt.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.topbar, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topbarTitle}>Expenses</Text>
          <Text style={styles.topbarSubtitle}>{periodLabel}</Text>
        </View>
        <TouchableOpacity
          style={styles.addHeaderBtn}
          onPress={() => router.push('/expenses/create' as any)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addHeaderBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs: All Expenses vs Category Breakdown */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'all' && styles.tabItemActive]}
          onPress={() => setActiveTab('all')}
        >
          <Ionicons
            name="receipt-outline"
            size={16}
            color={activeTab === 'all' ? Colors.primary : Colors.textMuted}
          />
          <Text
            style={[styles.tabItemText, activeTab === 'all' && styles.tabItemTextActive]}
          >
            All Expenses ({totalCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'breakdown' && styles.tabItemActive]}
          onPress={() => setActiveTab('breakdown')}
        >
          <Ionicons
            name="pie-chart-outline"
            size={16}
            color={activeTab === 'breakdown' ? Colors.primary : Colors.textMuted}
          />
          <Text
            style={[
              styles.tabItemText,
              activeTab === 'breakdown' && styles.tabItemTextActive,
            ]}
          >
            Breakdown
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeTab === 'all' ? filteredExpenses : []}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
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

            {/* Monthly Carousel */}
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

            {/* Custom Range */}
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

            {/* Summary KPI Card */}
            <View style={styles.summaryCard}>
              <View>
                <Text style={styles.summaryLabel}>TOTAL EXPENSES</Text>
                <Text style={styles.summaryAmount}>
                  {formatCurrency(activeTab === 'all' ? totalAmount : breakdownTotal)}
                </Text>
                <Text style={styles.summaryCount}>
                  {activeTab === 'all'
                    ? `${totalCount} expense records`
                    : `${breakdown.length} expense categories`}
                </Text>
              </View>
              <View style={styles.summaryIconWrap}>
                <Ionicons name="trending-down" size={24} color="#DC2626" />
              </View>
            </View>

            {activeTab === 'all' ? (
              <>
                {/* Search Bar */}
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by vendor, category, or note..."
                    placeholderTextColor={Colors.textMuted}
                    value={search}
                    onChangeText={setSearch}
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                      <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Category Horizontal Filter Chips */}
                {categories.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryChipsScroll}
                  >
                    <TouchableOpacity
                      style={[
                        styles.categoryChip,
                        selectedCategory === '' && styles.categoryChipActive,
                      ]}
                      onPress={() => setSelectedCategory('')}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          selectedCategory === '' && styles.categoryChipTextActive,
                        ]}
                      >
                        All Categories
                      </Text>
                    </TouchableOpacity>
                    {categories.map(cat => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryChip,
                          selectedCategory === cat && styles.categoryChipActive,
                        ]}
                        onPress={() =>
                          setSelectedCategory(selectedCategory === cat ? '' : cat)
                        }
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            selectedCategory === cat && styles.categoryChipTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            ) : (
              /* Breakdown View Rendered in Header Component */
              <View style={styles.breakdownContainer}>
                <Text style={styles.breakdownTitle}>Category Distribution</Text>
                {breakdown.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="pie-chart-outline" size={38} color={Colors.textMuted} />
                    <Text style={styles.emptyTitle}>No Breakdown Data</Text>
                    <Text style={styles.emptySubtitle}>
                      No expenses recorded for the selected date range.
                    </Text>
                  </View>
                ) : (
                  breakdown.map((item, idx) => {
                    const percentage =
                      breakdownTotal > 0
                        ? ((Number(item.total_amount) / breakdownTotal) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <View key={`${item.category}_${idx}`} style={styles.breakdownRow}>
                        <View style={styles.breakdownTopRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.breakdownCatName}>
                              {item.category}
                            </Text>
                            <Text style={styles.breakdownCatCount}>
                              {item.count} transaction{item.count !== 1 ? 's' : ''}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.breakdownCatAmount}>
                              {formatCurrency(Number(item.total_amount))}
                            </Text>
                            <Text style={styles.breakdownCatPercent}>
                              {percentage}%
                            </Text>
                          </View>
                        </View>
                        {/* Progress Bar */}
                        <View style={styles.progressBarTrack}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: `${Math.min(100, Math.max(2, parseFloat(percentage)))}%` },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const modeStyle = getModeBadgeStyle(item.payment_mode);
          const totalTax =
            (Number(item.cgst_amount) || 0) +
            (Number(item.sgst_amount) || 0) +
            (Number(item.igst_amount) || 0);

          return (
            <View style={styles.expenseCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{item.category}</Text>
                    </View>
                    {item.receipt_url ? (
                      <TouchableOpacity
                        style={styles.receiptTag}
                        onPress={() => handleOpenReceipt(item.receipt_url)}
                      >
                        <Ionicons name="attach" size={13} color="#2563EB" />
                        <Text style={styles.receiptTagText}>Receipt</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text style={styles.vendorName} numberOfLines={1}>
                    {item.vendor_name || 'General Expense'}
                  </Text>
                  <Text style={styles.dateText}>
                    {formatDisplayDate(item.date)}
                    {item.vendor_gstin ? ` · GSTIN: ${item.vendor_gstin}` : ''}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amountText}>
                    {formatCurrency(Number(item.amount))}
                  </Text>
                  <View
                    style={[
                      styles.modeBadge,
                      { backgroundColor: modeStyle.bg, borderColor: modeStyle.border },
                    ]}
                  >
                    <Text style={[styles.modeBadgeText, { color: modeStyle.text }]}>
                      {item.payment_mode}
                    </Text>
                  </View>
                </View>
              </View>

              {/* GST breakdown note if applied */}
              {item.is_gst_applicable && totalTax > 0 ? (
                <View style={styles.gstInfoRow}>
                  <Ionicons name="shield-checkmark-outline" size={13} color="#059669" />
                  <Text style={styles.gstInfoText}>
                    GST Included: {formatCurrency(totalTax)}
                    {item.igst_amount ? ` (IGST: ${formatCurrency(Number(item.igst_amount))})` : ''}
                    {item.cgst_amount ? ` (CGST+SGST: ${formatCurrency((Number(item.cgst_amount) || 0) * 2)})` : ''}
                  </Text>
                </View>
              ) : null}

              {/* Notes */}
              {item.notes ? (
                <View style={styles.notesRow}>
                  <Ionicons name="document-text-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.notesText} numberOfLines={2}>
                    {item.notes}
                  </Text>
                </View>
              ) : null}

              {/* Actions */}
              <View style={styles.cardActions}>
                {item.receipt_url ? (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleOpenReceipt(item.receipt_url)}
                  >
                    <Ionicons name="eye-outline" size={14} color="#2563EB" />
                    <Text style={[styles.actionBtnText, { color: '#2563EB' }]}>View Receipt</Text>
                  </TouchableOpacity>
                ) : <View style={{ flex: 1 }} />}

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/expenses/create' as any,
                        params: { id: item.id },
                      })
                    }
                  >
                    <Ionicons name="create-outline" size={15} color={Colors.primary} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteExpense(item)}
                  >
                    <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          activeTab === 'all' && !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Expenses Found</Text>
              <Text style={styles.emptySubtitle}>
                {search || selectedCategory
                  ? 'No expenses matched your filter criteria.'
                  : 'No expenses recorded for this period yet.'}
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => router.push('/expenses/create' as any)}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyAddBtnText}>Record First Expense</Text>
              </TouchableOpacity>
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
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  addHeaderBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Colors.primary,
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabItemTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  listContent: {
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
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderLeftWidth: 5,
    borderLeftColor: Colors.primary,
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
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9A3412',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#C2410C',
  },
  summaryCount: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  summaryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  categoryChipsScroll: {
    gap: 6,
    paddingBottom: 12,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  breakdownContainer: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginTop: 4,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 14,
  },
  breakdownRow: {
    marginBottom: 14,
  },
  breakdownTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownCatName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  breakdownCatCount: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  breakdownCatAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  breakdownCatPercent: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  expenseCard: {
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  categoryBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C2410C',
  },
  receiptTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  receiptTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 6,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  gstInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: Radius.sm,
    marginTop: 10,
  },
  gstInfoText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '500',
    flex: 1,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  notesText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: '#FFF7ED',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: '#FEF2F2',
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.danger,
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
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    marginTop: 12,
  },
  emptyAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
