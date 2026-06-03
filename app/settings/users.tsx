import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';

export default function UsersScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Manage Users</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Ionicons name="laptop-outline" size={48} color={Colors.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.title}>Available on Web</Text>
          <Text style={styles.desc}>User management (adding CA access, team members) is available on the Udyog web app.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => Linking.openURL('https://app.udyogbook.in/settings/users')}>
            <Ionicons name="open-outline" size={16} color="#fff" />
            <Text style={styles.btnText}>Open Web App</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  topbarTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 28, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center', width: '100%' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  desc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: 20, paddingVertical: 12 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
