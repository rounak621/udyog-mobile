import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Image, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '../constants/theme';

const { width, height } = Dimensions.get('window');

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

      {/* Logo */}
      <View style={styles.logoArea}>
        <Image
          source={require('../assets/udyog-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.tagline}>India's Simplest GST Billing</Text>
      </View>

      {/* Hero illustration */}
      <View style={styles.illustrationArea}>
        <Image
          source={require('../assets/hero-illustration.png')}
          style={styles.illustration}
          resizeMode="contain"
        />
      </View>

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
  logo: { width: 160, height: 52, tintColor: '#fff' },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 8, letterSpacing: 0.3 },
  illustrationArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  illustration: { width: width - 48, height: height * 0.38 },
  btnArea: { paddingBottom: 48, gap: 14 },
  primaryBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '800' },
  secondaryBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
