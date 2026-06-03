import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '../constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Top wave bg */}
      <View style={styles.topBg} />
      <View style={styles.wave} />

      {/* Logo */}
      <View style={styles.logoArea}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoLetter}>U</Text>
        </View>
        <Text style={styles.logoText}>Udyog</Text>
        <Text style={styles.logoSub}>GST Billing & Accounting</Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {[
          { icon: 'document-text-outline', text: 'Create GST invoices in seconds' },
          { icon: 'people-outline', text: 'Manage customers & suppliers' },
          { icon: 'bar-chart-outline', text: 'Track sales, purchases & reports' },
          { icon: 'shield-checkmark-outline', text: 'GSTR-1, GSTR-3B auto-filled' },
        ].map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon as any} size={18} color={Colors.primary} />
            </View>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* Buttons */}
      <View style={styles.btnArea}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.primaryBtnText}>Get Started — Free 14 days</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.secondaryBtnText}>I already have an account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBg: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.45, backgroundColor: Colors.primary },
  wave: { position: 'absolute', top: height * 0.38, left: -20, right: -20, height: 80, backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  logoArea: { alignItems: 'center', paddingTop: height * 0.1 },
  logoCircle: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  logoLetter: { fontSize: 36, fontWeight: '900', color: '#fff' },
  logoText: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  logoSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  features: { paddingHorizontal: 28, marginTop: height * 0.08 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  featureIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 14, color: Colors.text, fontWeight: '500', flex: 1 },
  btnArea: { paddingHorizontal: 24, position: 'absolute', bottom: 40, left: 0, right: 0 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, padding: 16, alignItems: 'center', marginBottom: 12 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { borderRadius: Radius.sm, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  secondaryBtnText: { color: Colors.text, fontSize: 14, fontWeight: '500' },
});
