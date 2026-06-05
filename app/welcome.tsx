import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Image, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/theme';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Background circles */}
      <View style={[styles.circle, { width: 250, height: 250, top: -80, right: -60 }]} />
      <View style={[styles.circle, { width: 150, height: 150, bottom: 160, left: -50, opacity: 0.05 }]} />
      <View style={[styles.circle, { width: 80, height: 80, top: 140, right: 30, opacity: 0.06 }]} />
      <View style={[styles.circle, { width: 50, height: 50, top: 200, left: 40, opacity: 0.05 }]} />

      {/* Logo Area */}
      <View style={styles.logoArea}>
        <Text style={styles.logoText}>UDYOG</Text>
        <Text style={styles.logoSubtext}>India's Simplest GST Billing</Text>
      </View>

      {/* Hero illustration */}
      <View style={styles.illustrationArea}>
        <Image
          source={require('../assets/hero-illustration.png')}
          style={styles.illustration}
          resizeMode="contain"
        />
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>500+</Text>
          <Text style={styles.statLabel}>Businesses</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>50K+</Text>
          <Text style={styles.statLabel}>Invoices</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>₹2Cr+</Text>
          <Text style={styles.statLabel}>Processed</Text>
        </View>
      </View>

      {/* Tagline */}
      <Text style={styles.centerTagline}>GST Billing • Inventory • Reports</Text>

      {/* Bottom buttons */}
      <View style={styles.btnArea}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.primaryBtnText}>Get Started — Free 14 days</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.secondaryBtnText}>I already have an account →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary, paddingHorizontal: 24 },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  logoArea: { alignItems: 'center', paddingTop: 64 },
  logoText: { color: '#ffffff', fontSize: 36, fontWeight: '800', letterSpacing: 6 },
  logoSubtext: { color: '#ffffff', fontSize: 13, opacity: 0.85, marginTop: 4 },
  illustrationArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: 'transparent' },
  illustration: { width: '100%', height: 320 },
  statsRow: { flexDirection: 'row', marginHorizontal: 20, gap: 10 },
  statCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 12, flex: 1, alignItems: 'center', justifyContent: 'center' },
  statNumber: { color: '#F97316', fontWeight: 'bold', fontSize: 20 },
  statLabel: { color: '#0F172A', fontSize: 11 },
  centerTagline: { color: '#ffffff', fontSize: 13, opacity: 0.7, textAlign: 'center', marginTop: 12, marginBottom: 20 },
  btnArea: { paddingBottom: 48, gap: 14 },
  primaryBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '800' },
  secondaryBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
