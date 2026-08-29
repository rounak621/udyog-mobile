import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomPadding } from '../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { setAuthToken, api } from '../../services/api';
import { quotationService, QuotationListItem } from '../../services/quotation';
import { showApiError } from '../../utils/apiError';
import { useBusiness } from '../../context/BusinessContext';
import { hasVistaarPlusAccess } from '../../utils/planAccess';

const STATUS_FILTERS = ['All', 'Pending', 'Accepted', 'Rejected', 'Expired'];
const LIMIT = 20;

export default function QuotationsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { business } = useBusiness();
  const bottomPadding = useBottomPadding(20);

  const hasAccess = hasVistaarPlusAccess(business);

  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [businessId, setBusinessId] = useState<string>('');

  const loadQuotations = async (currentSkip = 0, isRefreshing = false, filterOverride?: string) => {
    if (currentSkip === 0) {
      if (!isRefreshing) setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const token = await getToken();
      setAuthToken(token);

      let bId = businessId || business?.id || '';
      if (!bId) {
        const bizRes = await api.get('/businesses/me');
        bId = bizRes.data?.id || '';
        setBusinessId(bId);
      }

      if (!bId) {
        setLoading(false);
        return;
      }

      // If user is plan-gated, do not call quotations endpoint to prevent 403
      if (!hasAccess) {
        setQuotations([]);
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }

      const activeFilter = filterOverride !== undefined ? filterOverride : selectedFilter;
      const statusParam = activeFilter !== 'All' ? activeFilter.toUpperCase() : undefined;

      const data = await quotationService.listQuotations(bId, {
        status: statusParam,
        skip: currentSkip,
        limit: LIMIT,
      });

      const newItems = data.items || [];
      setTotal(data.total || 0);
      setSkip(currentSkip);

      if (currentSkip === 0) {
        setQuotations(newItems);
      } else {
        setQuotations(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const filteredNew = newItems.filter(i => !existingIds.has(i.id));
          return [...prev, ...filteredNew];
        });
      }
    } catch (err: any) {
      console.log('Quotations load error:', err);
      showApiError(err, 'Failed to load quotations');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadQuotations(0);
    }, [selectedFilter])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadQuotations(0, true);
  };

  const loadMore = () => {
    if (loading || loadingMore) return;
    if (quotations.length < total) {
      loadQuotations(skip + LIMIT);
    }
  };

  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter);
    loadQuotations(0, false, filter);
  };

  const handleCreatePress = () => {
    if (!hasAccess) {
      Alert.alert(
        'Plan Upgrade Required',
        'Estimates / Quotations are available on Vistaar, Premium, and Enterprise plans. Upgrade your subscription to create quotations.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Plans', onPress: () => router.push('/settings/subscription') },
        ]
      );
      return;
    }
    router.push('/quotations/create');
  };

  const filteredQuotations = quotations.filter(q => {
    if (!search.trim()) return true;
    const s = search.toLowerCase().trim();
    const matchNum = q.quotation_number?.toLowerCase().includes(s);
    const matchCust = (q.customer_name || q.walk_in_name || '').toLowerCase().includes(s);
    return matchNum || matchCust;
  });

  const getStatusBadgeStyle = (status: string, isConverted: boolean) => {
    if (isConverted) {
      return { badge: styles.convertedBadge, text: styles.convertedText, label: 'CONVERTED' };
    }
    const st = (status || 'PENDING').toUpperCase();
    switch (st) {
      case 'ACCEPTED':
        return { badge: styles.acceptedBadge, text: styles.acceptedText, label: 'ACCEPTED' };
      case 'REJECTED':
        return { badge: styles.rejectedBadge, text: styles.rejectedText, label: 'REJECTED' };
      case 'EXPIRED':
        return { badge: styles.expiredBadge, text: styles.expiredText, label: 'EXPIRED' };
      default:
        return { badge: styles.pendingBadge, text: styles.pendingText, label: 'PENDING' };
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const renderEmptyComponent = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      );
    }
    if (!hasAccess) {
      return null;
    }
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="document-text-outline" size={36} color={Colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>No Quotations Found</Text>
        <Text style={styles.emptySub}>
          {search
            ? 'No quotations match your search query.'
            : selectedFilter !== 'All'
            ? `No quotations with status "${selectedFilter}".`
            : 'Create your first estimate to send to customers.'}
        </Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={handleCreatePress}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.emptyBtnText}>New Quotation</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Top Header */}
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Quotations</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleCreatePress}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Plan-Gating Upsell Card */}
      {!hasAccess && (
        <View style={styles.upsellCard}>
          <Ionicons name="sparkles" size={24} color="#f59e0b" style={{ alignSelf: 'center', marginBottom: 8 }} />
          <Text style={styles.upsellTitle}>Estimates & Quotations Access</Text>
          <Text style={styles.upsellText}>
            Estimates and quotations are available on Vistaar, Premium, and Enterprise plans. Upgrade now to create and dispatch quotes to customers.
          </Text>
          <TouchableOpacity
            style={styles.upsellBtn}
            onPress={() => router.push('/settings/subscription')}
          >
            <Text style={styles.upsellBtnText}>Upgrade Subscription</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Input */}
      {hasAccess && (
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by quotation number or party..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Status Filter Chips */}
      {hasAccess && (
        <View style={{ height: 44, marginBottom: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: 'center' }}
          >
            {STATUS_FILTERS.map(f => {
              const active = selectedFilter === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => handleFilterChange(f)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Quotation List */}
      <FlatList
        data={hasAccess ? filteredQuotations : []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isConverted = !!item.converted_invoice_id;
          const statusInfo = getStatusBadgeStyle(item.status, isConverted);
          const customerName = item.customer_name || item.walk_in_name || 'Customer';
          const totalAmt = '₹' + (Number(item.total_amount) || 0).toLocaleString('en-IN');

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/quotations/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardIcon}>
                <Ionicons name="document-text" size={20} color={Colors.primary} />
              </View>

              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {customerName}
                </Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {item.quotation_number} · {formatDate(item.issue_date)}
                </Text>
                {item.valid_until && (
                  <Text style={styles.validUntilText} numberOfLines={1}>
                    Valid until: {formatDate(item.valid_until)}
                  </Text>
                )}
              </View>

              <View style={styles.cardRight}>
                <Text style={styles.cardAmount}>{totalAmt}</Text>
                <View style={[styles.badge, statusInfo.badge]}>
                  <Text style={[styles.badgeText, statusInfo.text]}>{statusInfo.label}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={[
          styles.list,
          (loading || filteredQuotations.length === 0) && { flexGrow: 1 },
          { paddingBottom: bottomPadding + 60 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        ListEmptyComponent={renderEmptyComponent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ paddingVertical: 12 }} color={Colors.primary} /> : null
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, !hasAccess && styles.fabDisabled]}
        onPress={handleCreatePress}
        activeOpacity={0.8}
      >
        <Ionicons name={hasAccess ? 'add' : 'lock-closed'} size={22} color="#fff" />
        <Text style={styles.fabText}>New Quotation</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text, height: '100%', paddingVertical: 0 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: '#64748b', fontWeight: '500', lineHeight: 16 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingTop: 4, paddingHorizontal: 12, gap: 8 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  cardSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  validUntilText: { fontSize: 11, color: '#F97316', marginTop: 2, fontWeight: '500' },
  cardRight: { alignItems: 'flex-end', justifyContent: 'center' },
  cardAmount: { fontSize: 14, fontWeight: '700', color: Colors.text },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: Colors.primary,
    borderRadius: 28,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  fabText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 6 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  emptyBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  upsellCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: Radius.md,
    padding: 16,
    margin: 16,
  },
  upsellTitle: { fontSize: 15, fontWeight: '700', color: '#92400e', textAlign: 'center', marginBottom: 4 },
  upsellText: { fontSize: 12.5, color: '#b45309', textAlign: 'center', lineHeight: 18, marginBottom: 14 },
  upsellBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  upsellBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  fabDisabled: { backgroundColor: '#94A3B8' },
});
