import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#FDF8F3' }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Privacy Policy</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <Text style={styles.sectionTitle}>Terms of Service</Text>
        <Text style={styles.bodyText}>
          {`Last updated: June 2026\n\n1. ACCEPTANCE OF TERMS\nBy creating an account and using Udyog ("the App", "the Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.\n\n2. DESCRIPTION OF SERVICE\nUdyog provides GST-compliant billing, invoicing, inventory management, and business reporting tools for small and medium businesses in India.\n\n3. ACCOUNT RESPONSIBILITIES\nYou are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You must provide accurate business and GSTIN information.\n\n4. SUBSCRIPTION & BILLING\nUdyog offers a free trial period followed by paid subscription plans. Subscription fees are processed via Razorpay. Fees are non-refundable except as required by law.\n\n5. DATA & INVOICE ACCURACY\nWhile Udyog assists in GST calculations, you remain solely responsible for the accuracy of invoices, GST filings, and compliance with applicable tax laws. Udyog is a tool, not a substitute for professional tax advice.\n\n6. LIMITATION OF LIABILITY\nUdyog is provided "as is". We are not liable for any indirect, incidental, or consequential damages arising from use of the Service, including but not limited to financial loss, tax penalties, or data loss.\n\n7. TERMINATION\nWe reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.\n\n8. CHANGES TO TERMS\nWe may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the revised terms.\n\n[This is placeholder content pending legal review. Replace with reviewed Terms of Service before relying on this in production.]`}
        </Text>
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Privacy Policy</Text>
        <Text style={styles.bodyText}>
          {`1. INFORMATION WE COLLECT\nWe collect business information (name, GSTIN, address), contact details (email, phone), and transaction data (invoices, customer records) necessary to provide the Service.\n\n2. HOW WE USE YOUR DATA\nYour data is used to generate invoices, calculate GST, provide reports, and improve the Service. We do not sell your personal or business data to third parties.\n\n3. DATA STORAGE & SECURITY\nYour data is stored on secure cloud infrastructure with industry-standard encryption. We take reasonable measures to protect your data from unauthorized access.\n\n4. THIRD-PARTY SERVICES\nWe use trusted third-party services for authentication (Clerk) and payment processing (Razorpay). These providers have their own privacy policies.\n\n5. DATA RETENTION\nWe retain your data for as long as your account is active or as needed to comply with legal obligations (including GST record-keeping requirements).\n\n6. YOUR RIGHTS\nYou may request access to, correction of, or deletion of your data by contacting our support team, subject to legal retention requirements.\n\n7. CONTACT US\nFor privacy concerns, contact support@udyogbook.in.\n\n[This is placeholder content pending legal review. Replace with reviewed Privacy Policy before relying on this in production.]`}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  bodyText: { fontSize: 13, color: '#475569', lineHeight: 21 },
});
