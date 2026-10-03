import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeScrollView } from '../../components/ui/SafeLayout';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { showApiError, getApiErrorMessage } from '../../utils/apiError';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AssignedCA {
  id: number;
  full_name: string;
  email: string;
  assigned_at: string;
}

export default function CAManagementScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [business, setBusiness] = useState<any>(null);
  const [cas, setCas] = useState<AssignedCA[]>([]);
  const [caLimit, setCaLimit] = useState<number>(0);
  const [overLimit, setOverLimit] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const token = await getToken();
      setAuthToken(token);

      // Fetch current active business
      const bizRes = await api.get('/businesses/me');
      setBusiness(bizRes.data);
      const bId = bizRes.data.id;

      // Fetch assigned CAs
      const casRes = await api.get(`/ca/business/${bId}/assigned-cas`);
      const casData = casRes.data;
      const casList = Array.isArray(casData) ? casData : (Array.isArray(casData?.cas) ? casData.cas : []);
      setCas(casList);

      let limitVal: number | null = typeof casData?.ca_limit === 'number' ? casData.ca_limit : null;
      let overLimitVal: boolean | null = typeof casData?.over_limit === 'boolean' ? casData.over_limit : null;

      try {
        const usageRes = await api.get(`/ca/business/${bId}/ca-usage`);
        if (typeof usageRes.data?.ca_limit === 'number') {
          limitVal = usageRes.data.ca_limit;
        }
        if (typeof usageRes.data?.over_limit === 'boolean') {
          overLimitVal = usageRes.data.over_limit;
        }
      } catch (e) {
        // ca-usage optional fallback
      }

      if (limitVal === null) {
        const plan = bizRes.data?.subscription_plan || 'basic';
        const planStr = typeof plan === 'object' && plan?.value ? plan.value : String(plan).toLowerCase();
        limitVal = (planStr === 'basic' || planStr === 'pro' || planStr === 'premium' || planStr === 'saral') ? 0 : 2;
      }

      if (overLimitVal === null) {
        overLimitVal = casList.length > limitVal;
      }

      setCaLimit(limitVal);
      setOverLimit(overLimitVal);
    } catch (err) {
      console.log('CA list fetch error:', err);
      showApiError(err, 'Failed to load CA list');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleAddCA = async () => {
    const email = emailInput.trim();
    if (!email) return;

    setAdding(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const bId = business?.id;
      await api.post(`/ca/business/${bId}/assign-ca`, { email });

      Alert.alert('Success', 'CA assigned successfully');
      setEmailInput('');
      loadData();
    } catch (err: any) {
      console.log('Add CA error:', err);
      const status = err.response?.status;

      if (status === 403) {
        Alert.alert('Limit Reached', getApiErrorMessage(err, 'CA limit reached for your plan. Upgrade your plan to add more CAs.'));
      } else {
        showApiError(err, 'Failed to assign CA. Please try again.');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveCA = (caId: number) => {
    Alert.alert(
      'Remove CA',
      'Are you sure you want to remove this CA? This will revoke their access to this business.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              setAuthToken(token);
              
              const bId = business?.id;
              await api.delete(`/ca/business/${bId}/remove-ca/${caId}`);
              
              Alert.alert('Success', 'CA removed successfully');
              loadData();
            } catch (err: any) {
              console.log('Remove CA error:', err);
              showApiError(err, 'Failed to remove CA. Please try again.');
            }
          }
        }
      ]
    );
  };

  const activeConnections = cas.length;
  const isAtLimit = overLimit || (caLimit > 0 && activeConnections >= caLimit) || caLimit === 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>CA Collaboration</Text>
        </View>
      </View>

      <SafeScrollView
        baseBottomPadding={80}
        contentContainerStyle={styles.scrollList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            colors={[Colors.primary]}
          />
        }
      >
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 13 }}>Loading CA details...</Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {/* Over Limit Alert Banner */}
            {overLimit && (
              <View style={{ backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: Radius.md, padding: 12, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="warning-outline" size={18} color="#D97706" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>CA Limit Exceeded</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#B45309', lineHeight: 18 }}>
                  You currently have {cas.length} CAs assigned, which exceeds your plan limit of {caLimit} {caLimit === 1 ? 'CA' : 'CAs'}. Existing CA links remain active, but you cannot assign new CAs without upgrading your plan or removing excess CAs.
                </Text>
              </View>
            )}

            {/* Limit Banner */}
            <View style={styles.bannerCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons 
                  name={caLimit > 0 ? "shield-checkmark" : "lock-closed"} 
                  size={20} 
                  color={overLimit ? '#D97706' : (caLimit > 0 ? Colors.success : Colors.primary)} 
                />
                <Text style={styles.bannerTitle}>
                  {caLimit > 0 
                    ? `${activeConnections} of ${caLimit} CAs used` 
                    : "CA Collaboration Access"
                  }
                </Text>
              </View>
              <Text style={styles.bannerSub}>
                {caLimit > 0 
                  ? `Your plan allows up to ${caLimit} active CAs to audit your records.`
                  : "CA access requires a premium plan. Upgrade now to enable CA collaboration."
                }
              </Text>
            </View>

            {/* List of Assigned CAs */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Assigned CAs</Text>
              {cas.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={36} color="#94a3b8" />
                  <Text style={styles.emptyText}>No Chartered Accountants assigned to this business yet.</Text>
                </View>
              ) : (
                cas.map((ca) => (
                  <View key={ca.id} style={styles.caRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.caName}>{ca.full_name}</Text>
                      <Text style={styles.caEmail}>{ca.email}</Text>
                      <Text style={styles.caDate}>
                        Assigned on {new Date(ca.assigned_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveCA(ca.id)} style={styles.removeBtn}>
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* Add CA Form or Upsell Block */}
            {caLimit > 0 ? (
              <View style={[styles.sectionCard, isAtLimit && { opacity: 0.6 }]}>
                <Text style={styles.sectionTitle}>Add Chartered Accountant</Text>
                {isAtLimit && (
                  <Text style={{ fontSize: 13, color: Colors.danger, marginBottom: 12 }}>
                    You have reached your limit of {caLimit} CA connections. Remove an existing CA to add a new one.
                  </Text>
                )}
                <Text style={styles.inputLabel}>CA Email Address</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    value={emailInput}
                    onChangeText={setEmailInput}
                    placeholder="Enter CA's email (e.g. ca@example.com)"
                    placeholderTextColor="#94a3b8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!adding && !isAtLimit}
                  />
                  <TouchableOpacity 
                    style={[styles.addBtn, (!emailInput.trim() || isAtLimit) && { opacity: 0.6 }]} 
                    onPress={handleAddCA}
                    disabled={adding || !emailInput.trim() || isAtLimit}
                  >
                    {adding ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.addBtnText}>Add</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.upsellCard}>
                <Ionicons name="sparkles" size={24} color="#f59e0b" style={{ alignSelf: 'center', marginBottom: 8 }} />
                <Text style={styles.upsellTitle}>Upgrade to Vistaar</Text>
                <Text style={styles.upsellText}>
                  Get 2 CA Collaboration Access, 6 Business limits, and 75 E-Way bills/month to expand your operations.
                </Text>
                <TouchableOpacity 
                  style={styles.upsellBtn}
                  onPress={() => router.push('/settings/subscription')}
                >
                  <Text style={styles.upsellBtnText}>Upgrade Subscription</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  scrollList: { paddingTop: 16, paddingHorizontal: 16 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 60 },
  bannerCard: { backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 14, gap: 6 },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  bannerSub: { fontSize: 11.5, color: Colors.textSecondary, lineHeight: 16 },
  sectionCard: { backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 14 },
  sectionTitle: { fontSize: 13.5, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyText: { fontSize: 11.5, color: Colors.textMuted, textAlign: 'center', lineHeight: 16 },
  caRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingVertical: 10 },
  caName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  caEmail: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 2 },
  caDate: { fontSize: 9.5, color: Colors.textMuted, marginTop: 4 },
  removeBtn: { padding: 8 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  inputContainer: { flexDirection: 'row', gap: 8 },
  textInput: { flex: 1, height: 40, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 12, fontSize: 12.5, color: Colors.text, backgroundColor: '#f8fafc' },
  addBtn: { backgroundColor: Colors.primary, height: 40, paddingHorizontal: 16, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  upsellCard: { backgroundColor: '#fef3c7', borderWidth: 0.5, borderColor: '#fde68a', borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  upsellTitle: { fontSize: 14, fontWeight: '700', color: '#92400e', marginBottom: 4 },
  upsellText: { fontSize: 11, color: '#b45309', textAlign: 'center', lineHeight: 16, marginBottom: 12 },
  upsellBtn: { backgroundColor: '#d97706', paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.sm },
  upsellBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' }
});
