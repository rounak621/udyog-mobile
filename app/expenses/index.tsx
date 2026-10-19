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
  Modal,
  BackHandler,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DesignTokens, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import DateRangePicker from '../../components/DateRangePicker';
import { FixedBottomBar, useBottomPadding } from '../../components/ui/SafeLayout';
import {
  expenseService,
  Expense,
  ExpenseCategorySummary,
} from '../../services/expenseService';

type FilterMode = 'monthly' | 'last60' | 'last90' | 'custom';

const formatCurrency = (amt: number): string => {
  return '₹' + Number(amt || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const formatDateToISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getMonthDetails = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthName = date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    monthName,
    startDate: formatDateToISO(start),
    endDate: formatDateToISO(end),
  };
};

const formatDateGroupHeader = (dateStr: string): string => {
  if (!dateStr) return '';
  const now = new Date();
  const todayIso = formatDateToISO(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = formatDateToISO(yesterday);

  const cleanDate = dateStr.slice(0, 10);
  const d = new Date(cleanDate + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;

  const dayNumber = d.getDate();
  const monthShort = d.toLocaleString('en-IN', { month: 'short' });

  if (cleanDate === todayIso) {
    return `Today, ${dayNumber} ${monthShort}`;
  }
  if (cleanDate === yesterdayIso) {
    return `Yesterday, ${dayNumber} ${monthShort}`;
  }

  if (d.getFullYear() === now.getFullYear()) {
    return `${dayNumber} ${monthShort}`;
  }
  return `${dayNumber} ${monthShort} ${d.getFullYear()}`;
};

const CATEGORY_COLORS = ['#FF7A1A', '#0F172A', '#64748B', '#CBD5E1', '#E2E8F0'];

export default function ExpensesScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [businessId, setBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Month navigation state
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // Filter mode
  const [filterMode, setFilterMode] = useState<FilterMode>('monthly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showDatesModal, setShowDatesModal] = useState(false);

  // Search & Category
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categoriesList, setCategoriesList] = useState<string[]>([]);

  // Breakdown modal
  const [showAllBreakdownModal, setShowAllBreakdownModal] = useState(false);

  // Data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
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

  // Date range calculation
  const { startDate, endDate, displayPeriodLabel } = useMemo(() => {
    if (filterMode === 'monthly') {
      const md = getMonthDetails(currentMonthDate);
      return {
        startDate: md.startDate,
        endDate: md.endDate,
        displayPeriodLabel: md.monthName,
      };
    } else if (filterMode === 'last60') {
      const today = new Date();
      const past = new Date(today);
      past.setDate(past.getDate() - 60);
      return {
        startDate: formatDateToISO(past),
        endDate: formatDateToISO(today),
        displayPeriodLabel: 'Last 60 Days',
      };
    } else if (filterMode === 'last90') {
      const today = new Date();
      const past = new Date(today);
      past.setDate(past.getDate() - 90);
      return {
        startDate: formatDateToISO(past),
        endDate: formatDateToISO(today),
        displayPeriodLabel: 'Last 90 Days',
      };
    } else {
      const s = customStart || formatDateToISO(currentMonthDate);
      const e = customEnd || formatDateToISO(new Date());
      return {
        startDate: s,
        endDate: e,
        displayPeriodLabel: `${s} - ${e}`,
      };
    }
  }, [filterMode, currentMonthDate, customStart, customEnd]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const bizRes = await api.get('/businesses/me');
      const bId = bizRes.data.id;
      setBusinessId(bId);

      const [listRes, catRes, breakdownRes] = await Promise.all([
        expenseService.listExpenses(bId, {
          startDate,
          endDate,
          category: selectedCategory !== 'All' ? selectedCategory : undefined,
          limit: 1000,
        }),
        expenseService.getCategories(bId),
        expenseService.getBreakdown(bId, {
          startDate,
          endDate,
        }),
      ]);

      setExpenses(listRes.items || []);
      setTotalAmount(Number(listRes.total_amount || 0));
      setCategoriesList(catRes || []);
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

  const handlePrevMonth = () => {
    setFilterMode('monthly');
    setCurrentMonthDate(prev => {
      const n = new Date(prev);
      n.setMonth(n.getMonth() - 1);
      return n;
    });
  };

  const handleNextMonth = () => {
    setFilterMode('monthly');
    setCurrentMonthDate(prev => {
      const n = new Date(prev);
      n.setMonth(n.getMonth() + 1);
      return n;
    });
  };

  // Filtered expenses by search text
  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase().trim();
    return expenses.filter(e => {
      return (
        e.category.toLowerCase().includes(q) ||
        (e.vendor_name || '').toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q)
      );
    });
  }, [expenses, search]);

  // Group expenses by date (sorted newest first)
  const groupedExpenses = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const exp of filteredExpenses) {
      const dateKey = (exp.date || '').slice(0, 10);
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(exp);
    }
    const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    return sortedKeys.map(dateKey => ({
      dateKey,
      headerTitle: formatDateGroupHeader(dateKey),
      rows: map.get(dateKey)!,
    }));
  }, [filteredExpenses]);

  // Top 4 categories + other for the total card
  const topCategories = useMemo(() => {
    if (!breakdown || breakdown.length === 0) return [];
    const sorted = [...breakdown].sort((a, b) => Number(b.total_amount) - Number(a.total_amount));
    if (sorted.length <= 4) {
      return sorted.map((c, i) => ({
        name: c.category,
        amount: Number(c.total_amount),
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }));
    }
    const top4 = sorted.slice(0, 4).map((c, i) => ({
      name: c.category,
      amount: Number(c.total_amount),
      color: CATEGORY_COLORS[i],
    }));
    const otherSum = sorted.slice(4).reduce((sum, c) => sum + Number(c.total_amount), 0);
    top4.push({
      name: 'Other',
      amount: otherSum,
      color: CATEGORY_COLORS[4],
    });
    return top4;
  }, [breakdown]);

  // Combined chips: 'All' + unique categories
  const chipList = useMemo(() => {
    const set = new Set<string>(['All']);
    categoriesList.forEach(c => set.add(c));
    expenses.forEach(e => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set);
  }, [categoriesList, expenses]);

  // Safe bottom padding for list
  const bottomPadding = useBottomPadding(20);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBackBtn}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={DesignTokens.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expenses</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => setShowSearch(prev => !prev)}
          style={styles.headerSearchBtn}
          accessibilityLabel="Search expenses"
        >
          <Ionicons
            name={showSearch ? 'close' : 'search'}
            size={22}
            color={DesignTokens.ink}
          />
        </TouchableOpacity>
      </View>

      {/* Optional Search Input */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={DesignTokens.mutedText} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by category, vendor or note..."
            placeholderTextColor={DesignTokens.lightText}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={DesignTokens.mutedText} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main List */}
      <FlatList
        data={groupedExpenses}
        keyExtractor={item => item.dateKey}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[DesignTokens.brandOrange]} />}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeaderWrap}>
            {/* Month Switcher Card */}
            <View style={styles.monthSwitcherCard}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={styles.monthArrowBtn}
                accessibilityLabel="Previous month"
              >
                <Ionicons name="chevron-back" size={20} color={DesignTokens.ink} />
              </TouchableOpacity>
              <Text style={styles.monthTitleText}>{displayPeriodLabel}</Text>
              <TouchableOpacity
                onPress={handleNextMonth}
                style={styles.monthArrowBtn}
                accessibilityLabel="Next month"
              >
                <Ionicons name="chevron-forward" size={20} color={DesignTokens.ink} />
              </TouchableOpacity>
            </View>

            {/* Other dates link */}
            <TouchableOpacity
              onPress={() => setShowDatesModal(true)}
              style={styles.otherDatesBtn}
            >
              <Text style={styles.otherDatesText}>
                {filterMode === 'monthly' ? 'Other dates' : 'Change date range'}
              </Text>
            </TouchableOpacity>

            {/* Total Card */}
            <View style={styles.totalCard}>
              <View>
                <Text style={styles.totalSubLabel}>
                  {filterMode === 'monthly' ? 'Spent this month' : 'Spent in selected period'}
                </Text>
                <Text style={styles.totalAmountText}>{formatCurrency(totalAmount)}</Text>
              </View>

              {/* Coloured segmented bar */}
              {breakdownTotal > 0 && topCategories.length > 0 && (
                <View style={styles.segmentedBarTrack}>
                  {topCategories.map((item, idx) => {
                    const pct = Math.max(1, (item.amount / breakdownTotal) * 100);
                    return (
                      <View
                        key={`bar_${item.name}_${idx}`}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: item.color,
                          height: '100%',
                        }}
                      />
                    );
                  })}
                </View>
              )}

              {/* Legend list */}
              {topCategories.length > 0 && (
                <View style={styles.legendContainer}>
                  {topCategories.map((item, idx) => (
                    <View key={`leg_${item.name}_${idx}`} style={styles.legendRow}>
                      <View style={[styles.legendColorBox, { backgroundColor: item.color }]} />
                      <Text style={styles.legendCatName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.legendCatAmount}>{formatCurrency(item.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* See all categories link */}
              {breakdown.length > 0 && (
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() => setShowAllBreakdownModal(true)}
                >
                  <Text style={styles.seeAllBtnText}>See all categories</Text>
                  <Ionicons name="arrow-forward" size={14} color={DesignTokens.orangeText} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Chips Scroll */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScrollContent}
            >
              {chipList.map(cat => {
                const isActive = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
                  >
                    <Text style={[styles.chipText, isActive ? styles.chipTextActive : styles.chipTextInactive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        renderItem={({ item: group }) => (
          <View style={styles.groupContainer}>
            <Text style={styles.groupHeader}>{group.headerTitle}</Text>
            {group.rows.map(exp => {
              const initial = (exp.category || 'E').charAt(0).toUpperCase();
              const noteText = exp.vendor_name || exp.notes || exp.payment_mode || 'General';

              return (
                <TouchableOpacity
                  key={exp.id}
                  style={styles.expenseRowCard}
                  onPress={() =>
                    router.push({
                      pathname: '/expenses/create' as any,
                      params: { id: exp.id },
                    })
                  }
                >
                  <View style={styles.rowInitialBox}>
                    <Text style={styles.rowInitialText}>{initial}</Text>
                  </View>
                  <View style={styles.rowMiddle}>
                    <Text style={styles.rowCategory} numberOfLines={1}>{exp.category}</Text>
                    <Text style={styles.rowNote} numberOfLines={1}>{noteText}</Text>
                  </View>
                  <Text style={styles.rowAmount}>{formatCurrency(Number(exp.amount))}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={44} color={DesignTokens.lightText} />
              <Text style={styles.emptyTitle}>No expenses found</Text>
              <Text style={styles.emptySub}>
                {search || selectedCategory !== 'All'
                  ? 'No expenses match the chosen filter.'
                  : 'You have not added any expenses for this period.'}
              </Text>
            </View>
          ) : (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={DesignTokens.brandOrange} />
            </View>
          )
        }
      />

      {/* Sticky Bottom Bar (OUTSIDE ScrollView) */}
      <FixedBottomBar style={styles.stickyBottomBar}>
        <TouchableOpacity
          style={styles.addExpenseBtn}
          onPress={() => router.push('/expenses/create' as any)}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addExpenseBtnText}>Add expense</Text>
        </TouchableOpacity>
      </FixedBottomBar>

      {/* Other Dates Selection Modal */}
      <Modal
        visible={showDatesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatesModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Date Range</Text>
              <TouchableOpacity
                onPress={() => setShowDatesModal(false)}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={22} color={DesignTokens.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.presetOptionsRow}>
              {[
                { key: 'monthly', label: 'This Month' },
                { key: 'last60', label: 'Last 60 Days' },
                { key: 'last90', label: 'Last 90 Days' },
                { key: 'custom', label: 'Custom Range' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.presetPill,
                    filterMode === opt.key && styles.presetPillActive,
                  ]}
                  onPress={() => {
                    setFilterMode(opt.key as FilterMode);
                    if (opt.key === 'monthly') {
                      const d = new Date();
                      d.setDate(1);
                      setCurrentMonthDate(d);
                    }
                    if (opt.key !== 'custom') {
                      setShowDatesModal(false);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.presetPillText,
                      filterMode === opt.key && styles.presetPillTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filterMode === 'custom' && (
              <View style={{ marginTop: 16 }}>
                <DateRangePicker
                  startDate={customStart || formatDateToISO(currentMonthDate)}
                  endDate={customEnd || formatDateToISO(new Date())}
                  onApply={(s, e) => {
                    setCustomStart(s);
                    setCustomEnd(e);
                    setShowDatesModal(false);
                  }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Breakdown Full View Modal */}
      <Modal
        visible={showAllBreakdownModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllBreakdownModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { maxHeight: '80%', paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>All Expense Categories</Text>
              <TouchableOpacity
                onPress={() => setShowAllBreakdownModal(false)}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={22} color={DesignTokens.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}>
              {breakdown.map((item, idx) => {
                const pct =
                  breakdownTotal > 0
                    ? ((Number(item.total_amount) / breakdownTotal) * 100).toFixed(1)
                    : '0';
                return (
                  <View key={`full_break_${item.category}_${idx}`} style={styles.breakdownDetailRow}>
                    <View style={styles.breakdownDetailTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.breakdownDetailCat}>{item.category}</Text>
                        <Text style={styles.breakdownDetailCount}>
                          {item.count} bill{item.count !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.breakdownDetailAmt}>{formatCurrency(Number(item.total_amount))}</Text>
                        <Text style={styles.breakdownDetailPct}>{pct}%</Text>
                      </View>
                    </View>
                    <View style={styles.breakdownTrack}>
                      <View style={[styles.breakdownFill, { width: `${Math.min(100, Math.max(2, parseFloat(pct)))}%` }]} />
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignTokens.pageBackground,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: DesignTokens.lines,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBackBtn: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DesignTokens.ink,
  },
  headerSearchBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: DesignTokens.ink,
    height: '100%',
    paddingVertical: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listHeaderWrap: {
    marginBottom: 4,
  },
  monthSwitcherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
  },
  monthArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: DesignTokens.ink,
  },
  otherDatesBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 2,
    marginBottom: 6,
  },
  otherDatesText: {
    fontSize: 13,
    fontWeight: '600',
    color: DesignTokens.orangeText,
  },
  totalCard: {
    padding: 16,
    gap: 12,
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  totalSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: DesignTokens.mutedText,
    marginBottom: 2,
  },
  totalAmountText: {
    fontSize: 22,
    fontWeight: '700',
    color: DesignTokens.ink,
  },
  segmentedBarTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: DesignTokens.lines,
  },
  legendContainer: {
    gap: 6,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendColorBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendCatName: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
  },
  legendCatAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: DesignTokens.ink,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: DesignTokens.lines,
  },
  seeAllBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: DesignTokens.orangeText,
  },
  chipsScrollContent: {
    gap: 8,
    paddingVertical: 2,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: DesignTokens.brandOrange,
  },
  chipInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  chipTextInactive: {
    color: DesignTokens.ink,
    fontWeight: '600',
  },
  groupContainer: {
    marginBottom: 12,
  },
  groupHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: DesignTokens.mutedText,
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  expenseRowCard: {
    width: '100%',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  rowInitialBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: DesignTokens.orangeTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInitialText: {
    fontSize: 14,
    fontWeight: '700',
    color: DesignTokens.orangeText,
  },
  rowMiddle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: DesignTokens.ink,
  },
  rowNote: {
    fontSize: 11,
    color: DesignTokens.mutedText,
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: DesignTokens.ink,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DesignTokens.ink,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: DesignTokens.mutedText,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  stickyBottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: DesignTokens.lines,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  addExpenseBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: Radius.md,
    backgroundColor: DesignTokens.brandOrange,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addExpenseBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: DesignTokens.lines,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DesignTokens.ink,
  },
  sheetCloseBtn: {
    padding: 4,
  },
  presetOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  presetPill: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: DesignTokens.lines,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetPillActive: {
    borderColor: DesignTokens.brandOrange,
    backgroundColor: DesignTokens.orangeTint,
  },
  presetPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: DesignTokens.ink,
  },
  presetPillTextActive: {
    color: DesignTokens.orangeText,
    fontWeight: '700',
  },
  breakdownDetailRow: {
    marginBottom: 16,
  },
  breakdownDetailTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownDetailCat: {
    fontSize: 14,
    fontWeight: '600',
    color: DesignTokens.ink,
  },
  breakdownDetailCount: {
    fontSize: 11,
    color: DesignTokens.mutedText,
    marginTop: 1,
  },
  breakdownDetailAmt: {
    fontSize: 14,
    fontWeight: '700',
    color: DesignTokens.ink,
  },
  breakdownDetailPct: {
    fontSize: 11,
    fontWeight: '600',
    color: DesignTokens.orangeText,
  },
  breakdownTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    backgroundColor: DesignTokens.brandOrange,
    borderRadius: 3,
  },
});
