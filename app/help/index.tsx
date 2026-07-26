import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Colors, Radius, Spacing } from '../../constants/theme';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I create a GST, Non-GST, or Service invoice?',
    a: 'When creating a new invoice, use the invoice type toggle at the top to switch between GST, Non-GST, and Service. Each has its own numbering sequence and PDF format.',
  },
  {
    q: 'How do I mark an invoice as paid?',
    a: 'Open the invoice from the Bills tab, tap "Mark as Paid", and select the payment mode.',
  },
  {
    q: "What's the difference between Unpaid and Partial?",
    a: 'Unpaid means no payment has been received yet. Partial means some payment has been made but the full amount is still outstanding.',
  },
  {
    q: 'How do I add a new customer or supplier?',
    a: 'Go to the Parties tab and tap the + button to add a new customer or supplier.',
  },
  {
    q: 'Can I edit an invoice after creating it?',
    a: 'Yes, open the invoice and tap Edit. This currently opens the edit screen in your browser.',
  },
  {
    q: 'Is my data safe?',
    a: 'Yes, your data is securely stored and backed up on our servers.',
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Contact Us */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('mailto:contact@udyogbook.in')}>
              <View style={styles.rowIcon}>
                <Ionicons name="mail-outline" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Email Support</Text>
                <Text style={styles.rowSub}>contact@udyogbook.in</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => Alert.alert(
              'Contact Support',
              'How would you like to reach us?',
              [
                { text: 'Call', onPress: () => Linking.openURL('tel:+917977422531') },
                { text: 'WhatsApp', onPress: () => Linking.openURL('https://wa.me/917977422531') },
                { text: 'Cancel', style: 'cancel' },
              ]
            )}>
              <View style={styles.rowIcon}>
                <Ionicons name="logo-whatsapp" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Call & WhatsApp Support</Text>
                <Text style={styles.rowSub}>+91 79774 22531</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.card}>
            {FAQS.map((item, idx) => {
              const open = openIndex === idx;
              const isLast = idx === FAQS.length - 1;
              return (
                <View key={idx} style={[styles.faqItem, isLast && styles.rowLast]}>
                  <TouchableOpacity style={styles.faqHeader} onPress={() => setOpenIndex(open ? null : idx)}>
                    <Text style={styles.faqQ}>{item.q}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                  {open ? <Text style={styles.faqA}>{item.a}</Text> : null}
                </View>
              );
            })}
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Info</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>{version}</Text>
            </View>
            <TouchableOpacity
              style={[styles.row, styles.rowLast]}
              onPress={() => Linking.openURL('mailto:contact@udyogbook.in?subject=Bug Report')}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="bug-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.rowLabel}>Report a Problem</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={styles.card}>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => router.push('/legal/terms')}>
              <View style={styles.rowIcon}>
                <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.rowLabel}>Terms & Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  section: { paddingHorizontal: 12, marginTop: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
  rowSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  rowValue: { fontSize: 13, color: Colors.textSecondary, marginRight: 4 },
  faqItem: { borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingHorizontal: 14 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  faqQ: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '600' },
  faqA: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, paddingBottom: 14, paddingRight: 24 },
});
