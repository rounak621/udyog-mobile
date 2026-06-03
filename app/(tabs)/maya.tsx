import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ScrollView, TextInput, ActivityIndicator, Alert
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';

export default function MayaScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const handleMicPress = () => {
    if (listening) {
      setListening(false);
      stopPulse();
    } else {
      setListening(true);
      startPulse();
      Alert.alert(
        'Voice Input',
        'Voice recording requires a development build. Use the text input below to try Maya.',
        [{ text: 'OK', onPress: () => { setListening(false); stopPulse(); } }]
      );
    }
  };

  const handleSendText = async () => {
    const text = manualInput.trim();
    if (!text) return;
    setLoading(true);
    setResult(null);
    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await api.post('/maya/parse', { text });
      setResult(res.data);
    } catch (err: any) {
      Alert.alert('Maya Error', err.response?.data?.detail || 'Could not process request');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = () => {
    if (result) {
      router.push({ pathname: '/invoice/create', params: { maya_data: JSON.stringify(result) } });
    }
  };

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.topbar}>
        <Text style={styles.title}>Maya</Text>
        <Text style={styles.subtitle}>AI Voice Billing</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Mic area */}
        <View style={styles.micArea}>
          <Animated.View style={[styles.micRing, { transform: [{ scale: pulseAnim }] }]} />
          <TouchableOpacity style={[styles.micBtn, listening && styles.micBtnActive]} onPress={handleMicPress}>
            <Ionicons name={listening ? 'stop' : 'mic'} size={36} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.micLabel}>{listening ? 'Listening... tap to stop' : 'Tap to speak'}</Text>
        </View>

        {/* Examples */}
        <View style={styles.examplesCard}>
          <Text style={styles.examplesTitle}>Try saying:</Text>
          {[
            '"Create invoice for Rajesh 5 steel pipes at 4200 each"',
            '"Bill Sunita Traders 10 bags cement 350 per bag GST 28%"',
            '"Invoice for Pawan 2 hours labour 1500 per hour"',
          ].map((ex, i) => (
            <TouchableOpacity key={i} style={styles.exampleChip} onPress={() => setManualInput(ex.replace(/"/g, ''))}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.primary} />
              <Text style={styles.exampleText}>{ex}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Text input */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Or type your billing instruction</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="e.g. Invoice for Rajesh 5 pipes at 4200..."
              placeholderTextColor={Colors.textMuted}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendText} disabled={loading || !manualInput.trim()}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Result */}
        {result && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.resultTitle}>Maya understood your request</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Customer</Text>
              <Text style={styles.resultValue}>{result.customer_name || '—'}</Text>
            </View>
            {(result.items || []).map((item: any, i: number) => (
              <View key={i} style={styles.resultRow}>
                <Text style={styles.resultLabel}>{item.name}</Text>
                <Text style={styles.resultValue}>{item.quantity} × {fmt(item.rate)}</Text>
              </View>
            ))}
            <View style={[styles.resultRow, { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8, paddingTop: 8 }]}>
              <Text style={[styles.resultLabel, { fontWeight: '700', color: Colors.text }]}>Total</Text>
              <Text style={[styles.resultValue, { color: Colors.primary, fontWeight: '700', fontSize: 16 }]}>{fmt(result.total_amount)}</Text>
            </View>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreateInvoice}>
              <Text style={styles.createBtnText}>Create Invoice →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: '600', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  micArea: { alignItems: 'center', paddingVertical: 32 },
  micRing: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: '#f9731620', top: 32 - 10 },
  micBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  micBtnActive: { backgroundColor: Colors.danger },
  micLabel: { fontSize: 14, color: Colors.textSecondary },
  examplesCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  examplesTitle: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  exampleChip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, backgroundColor: '#fff7ed', borderRadius: 8, marginBottom: 8 },
  exampleText: { fontSize: 12, color: Colors.text, flex: 1, lineHeight: 18 },
  inputCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  textInput: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 10, fontSize: 13, color: Colors.text, minHeight: 60, textAlignVertical: 'top' },
  sendBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  resultCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 1, borderColor: Colors.success + '40' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  resultTitle: { fontSize: 14, fontWeight: '600', color: Colors.success },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  resultLabel: { fontSize: 13, color: Colors.textSecondary },
  resultValue: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  createBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, padding: 13, alignItems: 'center', marginTop: 14 },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
