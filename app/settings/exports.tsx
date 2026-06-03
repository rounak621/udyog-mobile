import { useAuth } from '@clerk/clerk-expo';
import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, Share
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

export default function ExportsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (type: string, label: string) => {
    setLoading(type);
    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await api.get(`/data-integration/tally/${type}`, { responseType: 'text' });
      await Share.share({
        message: res.data,
        title: `${label}.xml`,
      });
    } catch (err: any) {
      Alert.alert('Export Failed', err.response?.data?.detail || 'Could not export data');
    } finally {
      setLoading(null);
    }
  };

  const exports = [
    { type: 'parties', label: 'Parties (Masters)', icon: 'people-outline', color: Colors.primary, desc: 'Export all customers & suppliers' },
    { type: 'items', label: 'Items (Masters)', icon: 'cube-outline', color: Colors.info, desc: 'Export all stock items & services' },
    { type: 'invoices', label: 'Invoices (Transactions)', icon: 'document-text-outline', color: Colors.success, desc: 'Export all sales invoices' },
    { type: 'purchases', label: 'Purchases (Transactions)', icon: 'cart-outline', color: '#8b5cf6', desc: 'Export all purchase bills' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Export to Tally</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.info} />
          <Text style={styles.infoText}>Import into Tally Prime: Gateway of Tally → Import Data. Import Parties & Items first (Masters), then Invoices & Purchases (Transactions).</Text>
        </View>

        {exports.map(exp => (
          <TouchableOpacity key={exp.type} style={styles.exportCard} onPress={() => handleExport(exp.type, exp.label)} disabled={loading === exp.type}>
            <View style={[styles.exportIcon, { backgroundColor: exp.color + '15' }]}>
              <Ionicons name={exp.icon as any} size={22} color={exp.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exportLabel}>{exp.label}</Text>
              <Text style={styles.exportDesc}>{exp.desc}</Text>
            </View>
            {loading === exp.type ? (
              <ActivityIndicator color={exp.color} />
            ) : (
              <Ionicons name="download-outline" size={20} color={Colors.textMuted} />
            )}
          </TouchableOpacity>
        ))}

        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>Import Order</Text>
          {[
            { step: '1', label: 'Parties XML', type: 'Masters' },
            { step: '2', label: 'Items XML', type: 'Masters' },
            { step: '3', label: 'Invoices XML', type: 'Transactions' },
            { step: '4', label: 'Purchases XML', type: 'Transactions' },
          ].map(s => (
            <View key={s.step} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{s.step}</Text></View>
              <Text style={styles.stepLabel}>{s.label}</Text>
              <View style={[styles.stepType, s.type === 'Masters' ? styles.stepMaster : styles.stepTransaction]}>
                <Text style={[styles.stepTypeText, s.type === 'Masters' ? styles.stepMasterText : styles.stepTransactionText]}>{s.type}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  infoCard: { flexDirection: 'row', gap: 10, backgroundColor: '#eff6ff', borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: '#bfdbfe', alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 12, color: Colors.info, lineHeight: 18 },
  exportCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  exportIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  exportLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 3 },
  exportDesc: { fontSize: 12, color: Colors.textSecondary },
  stepsCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  stepsTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepLabel: { flex: 1, fontSize: 13, color: Colors.text },
  stepType: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  stepMaster: { backgroundColor: '#f0fdf4' },
  stepTransaction: { backgroundColor: '#fff7ed' },
  stepTypeText: { fontSize: 11, fontWeight: '600' },
  stepMasterText: { color: Colors.success },
  stepTransactionText: { color: Colors.primary },
});
