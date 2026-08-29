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
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomPadding } from '../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { setAuthToken, api } from '../../services/api';
import { recurringBillsService, RecurringBillTemplate } from '../../services/recurringBills';
import { showApiError } from '../../utils/apiError';
import { useBusiness } from '../../context/BusinessContext';
import { hasVistaarPlusAccess } from '../../utils/planAccess';

export default function AutomatedBillsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { business } = useBusiness();
  const fabBottom = useBottomPadding(84);
  const bottomPadding = useBottomPadding(20);

  const [templates, setTemplates] = useState<RecurringBillTemplate[]>([]);
  const [customersMap, setCustomersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [businessId, setBusinessId] = useState<string>('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Plan Gating Check
  const hasAccess = hasVistaarPlusAccess(business);

  const loadData = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
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

      // If user is plan-gated, do not call recurring bills endpoint to prevent 403
      if (!hasAccess) {
        setTemplates([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [templatesRes, customersRes] = await Promise.all([
        recurringBillsService.list(bId),
        api.get(`/customers/?business_id=${bId}`),
      ]);

      const customersList = Array.isArray(customersRes.data)
        ? customersRes.data
        : customersRes.data?.items || customersRes.data?.customers || [];
      const cMap: Record<string, string> = {};
      customersList.forEach((c: any) => {
        cMap[String(c.id)] = c.name;
      });
      setCustomersMap(cMap);
      setTemplates(templatesRes || []);
    } catch (err: any) {
      console.log('Automated bills load error:', err);
      // If 403, user plan gated
      if (err.response?.status !== 403) {
        showApiError(err, 'Failed to load automated bills');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [hasAccess])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleToggleStatus = async (template: RecurringBillTemplate) => {
    if (template.status === 'stopped') return;
    const nextStatus = template.status === 'active' ? 'paused' : 'active';
    setTogglingId(template.id);
    try {
      const token = await getToken();
      setAuthToken(token);
      const updated = await recurringBillsService.update(template.business_id, template.id, {
        status: nextStatus,
      });
      setTemplates(prev => prev.map(t => (t.id === template.id ? updated : t)));
    } catch (err: any) {
      showApiError(err, `Failed to ${nextStatus === 'active' ? 'resume' : 'pause'} automated bill`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = (template: RecurringBillTemplate) => {
    Alert.alert(
      'Delete Automated Bill',
      'Are you sure you want to delete this automated bill template? Future runs will be cancelled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              setAuthToken(token);
              await recurringBillsService.remove(template.business_id, template.id);
              setTemplates(prev => prev.filter(t => t.id !== template.id));
            } catch (err: any) {
              showApiError(err, 'Failed to delete automated bill template');
            }
          },
        },
      ]
    );
  };

  const handleCreatePress = () => {
    if (!hasAccess) {
      Alert.alert(
        'Plan Upgrade Required',
        'Automated recurring billing is available on Vistaar, Premium, and Enterprise plans. Upgrade your subscription to create automated bills.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Plans', onPress: () => router.push('/settings/subscription') },
        ]
      );
      return;
    }
    router.push('/automated-bills/create');
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
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const calculateTemplateTotal = (items: any[]) => {
    let total = 0;
    (items || []).forEach(item => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const gst = Number(item.gst_rate) || 0;
      const disc = Number(item.discount_percent) || 0;
      const taxable = qty * rate * (1 - disc / 100);
      total += taxable * (1 + gst / 100);
    });
    return Math.round(total);
  };

  const filteredTemplates = templates.filter(t => {
    if (!search.trim()) return true;
    const s = search.toLowerCase().trim();
    const cust = (customersMap[String(t.customer_id)] || t.customer_name || '').toLowerCase();
    const notes = (t.notes || '').toLowerCase();
    return cust.includes(s) || notes.includes(s);
  });

  const getStatusBadge = (status: string) => {
    const st = (status || 'active').toLowerCase();
    switch (st) {
      case 'paused':
        return { badge: styles.pausedBadge, text: styles.pausedText, label: 'PAUSED' };
      case 'stopped':
        return { badge: styles.stoppedBadge, text: styles.stoppedText, label: 'STOPPED' };
      default:
        return { badge: styles.activeBadge, text: styles.activeText, label: 'ACTIVE' };
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
          <Ionicons name="repeat-outline" size={36} color={Colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>No Automated Bills Yet</Text>
        <Text style={styles.emptySub}>
          {search
            ? 'No templates match your search.'
            : 'Set up recurring templates to auto-generate and dispatch customer invoices.'}
        </Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={handleCreatePress}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.emptyBtnText}>New Automated Bill</Text>
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
          <Text style={styles.title}>Automated Bills</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleCreatePress}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Plan-Gating Upsell Card (matches ca-management.tsx pattern) */}
      {!hasAccess && (
        <View style={styles.upsellCard}>
          <Ionicons name="sparkles" size={24} color="#f59e0b" style={{ alignSelf: 'center', marginBottom: 8 }} />
          <Text style={styles.upsellTitle}>Automated Bills Access</Text>
          <Text style={styles.upsellText}>
            Automated recurring bills are available on Vistaar, Premium, and Enterprise plans. Upgrade now to automate scheduled invoice generation.
          </Text>
          <TouchableOpacity
            style={styles.upsellBtn}
            onPress={() => router.push('/settings/subscription')}
          >
            <Text style={styles.upsellBtnText}>Upgrade Subscription</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Input (only when has access) */}
      {hasAccess && (
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer name or notes..."
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

      {/* Templates List */}
      <FlatList
        data={hasAccess ? filteredTemplates : []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const custName = customersMap[String(item.customer_id)] || item.customer_name || 'Customer';
          const scheduleStr = formatSchedule(item.frequency, item.billing_day, item.billing_time);
          const statusInfo = getStatusBadge(item.status);
          const totalAmt = '₹' + calculateTemplateTotal(item.line_items).toLocaleString('en-IN');
          const isToggling = togglingId === item.id;

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/automated-bills/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons name="repeat" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {custName}
                  </Text>
                  <Text style={styles.cardSchedule} numberOfLines={1}>
                    {scheduleStr}
                  </Text>
                </View>
                <View style={[styles.badge, statusInfo.badge]}>
                  <Text style={[styles.badgeText, statusInfo.text]}>{statusInfo.label}</Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.metaLabel}>NEXT RUN DATE</Text>
                  <Text style={styles.metaValue}>{formatDate(item.next_run_date)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metaLabel}>EST. AMOUNT</Text>
                  <Text style={styles.cardAmount}>{totalAmt}</Text>
                </View>
              </View>

              {/* Quick Actions Row */}
              <View style={styles.actionRow}>
                {item.status !== 'stopped' && (
                  <TouchableOpacity
                    style={styles.actionPill}
                    onPress={() => handleToggleStatus(item)}
                    disabled={isToggling}
                  >
                    {isToggling ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <>
                        <Ionicons
                          name={item.status === 'active' ? 'pause-outline' : 'play-outline'}
                          size={14}
                          color={Colors.primary}
                        />
                        <Text style={styles.actionPillText}>
                          {item.status === 'active' ? 'Pause' : 'Resume'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionPill, styles.deletePill]}
                  onPress={() => handleDelete(item)}
                >
                  <Ionicons name="trash-outline" size={14} color={Colors.danger} />
                  <Text style={[styles.actionPillText, { color: Colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={[
          styles.list,
          (loading || filteredTemplates.length === 0) && { flexGrow: 1 },
          { paddingBottom: bottomPadding + 60 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        ListEmptyComponent={renderEmptyComponent}
      />

      {/* Safe FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }, !hasAccess && styles.fabDisabled]}
        onPress={handleCreatePress}
        activeOpacity={0.8}
      >
        <Ionicons name={hasAccess ? 'add' : 'lock-closed'} size={20} color="#fff" />
        <Text style={styles.fabText}>New Automated Bill</Text>
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
  list: { paddingTop: 4, paddingHorizontal: 12, gap: 10 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardSchedule: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cardDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  metaLabel: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  metaValue: { fontSize: 12, fontWeight: '600', color: Colors.text, marginTop: 2 },
  cardAmount: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: '#FFF7ED',
    borderWidth: 0.5,
    borderColor: '#FED7AA',
  },
  actionPillText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  deletePill: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  activeBadge: { backgroundColor: '#F0FDF4' },
  activeText: { color: '#16A34A' },
  pausedBadge: { backgroundColor: '#FFF7ED' },
  pausedText: { color: '#C2410C' },
  stoppedBadge: { backgroundColor: '#F1F5F9' },
  stoppedText: { color: '#64748B' },
  badgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  fab: {
    position: 'absolute',
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
  fabDisabled: { backgroundColor: '#94A3B8' },
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
});
