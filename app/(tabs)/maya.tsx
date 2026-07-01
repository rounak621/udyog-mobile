import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ScrollView, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { Audio } from 'expo-av';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface MayaResponse {
  reply_text: string;
  intent: string;
  action_type?: string | null;
  current_draft?: any;
  extracted_data?: any;
  audio_b64?: string | null;
  user_text?: string | null;
  user_transcript?: string | null;
  navigation_route?: string | null;
  new_entity_name?: string | null;
}

export default function MayaScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [listening, setListening] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string; draft?: any; actionType?: string }[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Fetch business ID on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const bizRes = await api.get('/businesses/me');
        setBusinessId(bizRes.data.id);
      } catch (err) {
        console.log('Maya: failed to load business ID', err);
      }
    })();
  }, []);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

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

  const playAudio = async (base64Audio: string) => {
    try {
      // Unload previous sound if any
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${base64Audio}` },
        { shouldPlay: true }
      );
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
    } catch (err) {
      console.log('Maya: audio playback error', err);
    }
  };

  const handleSendText = async () => {
    const text = manualInput.trim();
    if (!text || !businessId) return;

    setManualInput('');
    setLoading(true);

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', text }]);

    try {
      const token = await getToken();
      setAuthToken(token);

      // Build multipart/form-data
      const formData = new FormData();
      formData.append('business_id', businessId);
      formData.append('text', text);
      formData.append('conversation_history', JSON.stringify(conversationHistory));

      const res = await api.post('/ai/maya-chat', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      const data: MayaResponse = res.data;

      // Extract draft from either current_draft or extracted_data (backend compat)
      const draft = data.current_draft || data.extracted_data || null;

      // Add assistant message
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.reply_text || '',
        draft: data.action_type === 'draft_invoice' ? draft : undefined,
        actionType: data.action_type || undefined,
      }]);

      // Update conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: data.reply_text || '' },
      ]);

      // Play TTS audio if present
      if (data.audio_b64) {
        playAudio(data.audio_b64);
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Could not process request';
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${detail}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleCreateInvoice = (draft: any) => {
    if (!draft) return;
    router.push({
      pathname: '/invoice/create',
      params: { maya_data: JSON.stringify(draft) },
    });
  };

  const handleClearChat = () => {
    setMessages([]);
    setConversationHistory([]);
  };

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.topbar}>
        <View style={styles.topbarRow}>
          <View>
            <Text style={styles.title}>Maya</Text>
            <Text style={styles.subtitle}>AI Voice Billing</Text>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity onPress={handleClearChat} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <>
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
          </>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <View key={i} style={[styles.msgRow, msg.role === 'user' ? styles.msgRowUser : styles.msgRowAssistant]}>
            <View style={[styles.msgBubble, msg.role === 'user' ? styles.msgBubbleUser : styles.msgBubbleAssistant]}>
              <Text style={[styles.msgText, msg.role === 'user' && styles.msgTextUser]}>{msg.text}</Text>

              {/* Draft invoice card */}
              {msg.draft && msg.actionType === 'draft_invoice' && (
                <View style={styles.draftCard}>
                  <View style={styles.draftHeader}>
                    <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
                    <Text style={styles.draftTitle}>Invoice Draft</Text>
                  </View>
                  {msg.draft.customer_name && (
                    <View style={styles.draftRow}>
                      <Text style={styles.draftLabel}>Customer</Text>
                      <Text style={styles.draftValue}>{msg.draft.customer_name}</Text>
                    </View>
                  )}
                  {(msg.draft.items || []).map((item: any, j: number) => (
                    <View key={j} style={styles.draftRow}>
                      <Text style={styles.draftLabel}>{item.name || 'Item'}</Text>
                      <Text style={styles.draftValue}>
                        {item.qty || item.quantity || 1} x {fmt(item.rate || item.unit_price || 0)}
                      </Text>
                    </View>
                  ))}
                  {msg.draft.total_amount && (
                    <View style={[styles.draftRow, styles.draftTotalRow]}>
                      <Text style={styles.draftTotalLabel}>Total</Text>
                      <Text style={styles.draftTotalValue}>{fmt(msg.draft.total_amount)}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.createBtn} onPress={() => handleCreateInvoice(msg.draft)}>
                    <Text style={styles.createBtnText}>Create Invoice</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ))}

        {/* Processing indicator */}
        {loading && (
          <View style={[styles.msgRow, styles.msgRowAssistant]}>
            <View style={[styles.msgBubble, styles.msgBubbleAssistant]}>
              <View style={styles.dotsRow}>
                <PulsingDot delay={0} />
                <PulsingDot delay={200} />
                <PulsingDot delay={400} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={manualInput}
          onChangeText={setManualInput}
          placeholder={businessId ? 'Type your billing instruction...' : 'Loading...'}
          placeholderTextColor={Colors.textMuted}
          editable={!!businessId && !loading}
          onSubmitEditing={handleSendText}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!manualInput.trim() || loading || !businessId) && styles.sendBtnDisabled]}
          onPress={handleSendText}
          disabled={loading || !manualInput.trim() || !businessId}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Pulsing dot component for typing indicator */
function PulsingDot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return <Animated.View style={[styles.dot, { opacity }]} />;
}

const styles = StyleSheet.create({
  topbar: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  topbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  clearBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  content: { padding: 16, gap: 12, paddingBottom: 20 },
  micArea: { alignItems: 'center', paddingVertical: 32 },
  micRing: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: '#f9731620', top: 22 },
  micBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  micBtnActive: { backgroundColor: Colors.danger },
  micLabel: { fontSize: 14, color: Colors.textSecondary },
  examplesCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: Colors.border },
  examplesTitle: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  exampleChip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, backgroundColor: '#fff7ed', borderRadius: 8, marginBottom: 8 },
  exampleText: { fontSize: 12, color: Colors.text, flex: 1, lineHeight: 18 },

  // Chat messages
  msgRow: { marginBottom: 4 },
  msgRowUser: { alignItems: 'flex-end' },
  msgRowAssistant: { alignItems: 'flex-start' },
  msgBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  msgBubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  msgBubbleAssistant: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  msgText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  msgTextUser: { color: '#fff' },

  // Draft card inside assistant bubble
  draftCard: {
    marginTop: 10,
    backgroundColor: '#fefce8',
    borderRadius: 10,
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#fbbf2440',
  },
  draftHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  draftTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  draftRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  draftLabel: { fontSize: 12, color: Colors.textSecondary },
  draftValue: { fontSize: 12, color: Colors.text, fontWeight: '500' },
  draftTotalRow: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 6, paddingTop: 8 },
  draftTotalLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  draftTotalValue: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  createBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 6,
  },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Typing indicator dots
  dotsRow: { flexDirection: 'row', gap: 5, paddingVertical: 4, paddingHorizontal: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316' },

  // Bottom input bar
  inputBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 34,
    backgroundColor: Colors.card,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
