import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useState } from 'react';
import { Colors, Radius } from '../constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, setAuthToken } from '../services/api';

export default function OnboardingScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [selected, setSelected] = useState<'owner' | 'ca' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selected) return;
    if (selected === 'ca') return;
    setLoading(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.put('/users/me/role', { role: 'USER' });
    } catch {}
    setLoading(false);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoLetter}>U</Text>
        </View>
        <Text style={styles.logoText}>Udyog</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Who are you?</Text>
        <Text style={styles.subtitle}>Help us personalize your experience</Text>

        <TouchableOpacity
          style={[styles.optionCard, selected === 'owner' && styles.optionCardActive]}
          onPress={() => setSelected('owner')}
        >
          <View style={[styles.optionIcon, selected === 'owner' && styles.optionIconActive]}>
            <Ionicons name="business-outline" size={28} color={selected === 'owner' ? '#fff' : Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionTitle, selected === 'owner' && styles.optionTitleActive]}>Business Owner</Text>
            <Text style={styles.optionSub}>Create invoices, manage customers & track GST</Text>
          </View>
          {selected === 'owner' && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionCard, selected === 'ca' && styles.optionCardActive]}
          onPress={() => setSelected('ca')}
        >
          <View style={[styles.optionIcon, selected === 'ca' && styles.optionIconActive]}>
            <Ionicons name="calculator-outline" size={28} color={selected === 'ca' ? '#fff' : Colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionTitle, selected === 'ca' && styles.optionTitleActive]}>Chartered Accountant</Text>
            <Text style={styles.optionSub}>Manage multiple clients and their accounts</Text>
          </View>
          {selected === 'ca' && <Ionicons name="checkmark-circle" size={22} color={Colors.info} />}
        </TouchableOpacity>

        {selected === 'ca' && (
          <View style={styles.caNotice}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.info} />
            <View style={{ flex: 1 }}>
              <Text style={styles.caNoticeText}>CA features are available on the web platform only.</Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://app.udyogbook.in')}>
                <Text style={styles.caLink}>Open Udyog Web →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!selected || loading}
        >
          <Text style={styles.continueBtnText}>
            {loading ? 'Setting up...' : selected === 'ca' ? 'Open Web App' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingTop: 60, paddingBottom: 30, alignItems: 'center' },
  logoCircle: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  logoLetter: { fontSize: 24, fontWeight: '900', color: '#fff' },
  logoText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  content: { flex: 1, padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginTop: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, marginBottom: 28 },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: '#e2e8f0' },
  optionCardActive: { borderColor: Colors.primary, backgroundColor: '#fff7ed' },
  optionIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  optionIconActive: { backgroundColor: Colors.primary },
  optionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  optionTitleActive: { color: Colors.primary },
  optionSub: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  caNotice: { flexDirection: 'row', gap: 10, backgroundColor: '#eff6ff', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#bfdbfe', alignItems: 'flex-start' },
  caNoticeText: { fontSize: 13, color: Colors.info, lineHeight: 18 },
  caLink: { fontSize: 13, color: Colors.info, fontWeight: '700', marginTop: 6, textDecorationLine: 'underline' },
  continueBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, padding: 16, alignItems: 'center', marginTop: 8 },
  continueBtnDisabled: { backgroundColor: '#e2e8f0' },
  continueBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
