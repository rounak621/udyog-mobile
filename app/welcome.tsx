import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAF9" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoIcon}>
            <Ionicons name="document-text" size={18} color="#fff" />
          </View>
          <Text style={styles.logoText}>Udyog</Text>
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: 36 }}>
          <Text style={styles.headline}>
            Bill customers in{'\n'}
            <Text style={{ color: '#F97316' }}>seconds.</Text>
          </Text>
          <Text style={styles.subline}>GST invoices, inventory, and reports —{'\n'}built for Indian businesses.</Text>
        </View>

        <View style={styles.voiceChip}>
          <View style={styles.voiceChipIcon}>
            <Ionicons name="mic" size={14} color="#fff" />
          </View>
          <Text style={styles.voiceChipText}>Just speak — create invoices by voice</Text>
        </View>

        <View style={styles.mockupCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.mockupAvatar}>
                <Text style={styles.mockupAvatarText}>RT</Text>
              </View>
              <View>
                <Text style={styles.mockupName}>Ravi Traders</Text>
                <Text style={styles.mockupSub}>Invoice 2026/091</Text>
              </View>
            </View>
            <View style={styles.paidBadge}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' }} />
              <Text style={styles.paidBadgeText}>PAID</Text>
            </View>
          </View>
          <View style={styles.mockupDivider} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={styles.mockupLabel}>Subtotal</Text>
            <Text style={styles.mockupValue}>₹21,000</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={styles.mockupLabel}>GST · 18%</Text>
            <Text style={styles.mockupValue}>₹3,750</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text style={styles.mockupTotalLabel}>TOTAL</Text>
              <Text style={styles.mockupTotal}>₹24,750</Text>
            </View>
            <View style={styles.sentBadge}>
              <Ionicons name="paper-plane-outline" size={13} color="#F97316" />
              <Text style={styles.sentBadgeText}>Sent</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Text style={styles.statText}><Text style={styles.statBold}>500+</Text> Businesses</Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.statText}><Text style={styles.statBold}>50K+</Text> Invoices</Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.statText}><Text style={styles.statBold}>₹2Cr+</Text> Processed</Text>
        </View>

        <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.ctaBtnText}>Get Started — Free 14 days</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginLinkText}>I already have an account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9' },
  scrollContent: { paddingTop: 24, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, marginTop: 16 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  headline: { fontSize: 40, fontWeight: '800', color: '#0F172A', lineHeight: 44 },
  subline: { fontSize: 15, color: '#64748B', marginTop: 14, lineHeight: 22 },
  voiceChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF2E8', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 24, marginHorizontal: 24 },
  voiceChipIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  voiceChipText: { fontSize: 13, fontWeight: '700', color: '#C2410C' },
  mockupCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginHorizontal: 24, marginTop: 28, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16 },
  mockupAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  mockupAvatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  mockupName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  mockupSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FDF4', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  paidBadgeText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  mockupDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
  mockupLabel: { fontSize: 13, color: '#64748B' },
  mockupValue: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  mockupTotalLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  mockupTotal: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  sentBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF7ED', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  sentBadgeText: { fontSize: 12, fontWeight: '700', color: '#F97316' },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 36, marginHorizontal: 24, flexWrap: 'wrap' },
  statText: { fontSize: 13, color: '#94A3B8' },
  statBold: { fontWeight: '800', color: '#0F172A' },
  statDot: { fontSize: 13, color: '#CBD5E1', marginHorizontal: 8 },
  ctaBtn: { backgroundColor: '#F97316', borderRadius: 16, marginHorizontal: 24, marginTop: 20, paddingVertical: 18, alignItems: 'center', elevation: 4, shadowColor: '#F97316', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginLink: { alignItems: 'center', marginTop: 16, marginBottom: 24 },
  loginLinkText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
});
