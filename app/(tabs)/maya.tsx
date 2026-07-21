import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ScrollView, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, Keyboard
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { useMayaRecording } from '../../context/MayaRecordingContext';

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
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string; draft?: any; actionType?: string }[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  
  const scrollRef = useRef<ScrollView>(null);

  // Live refs so the registered session always reads fresh values
  const businessIdRef = useRef<string | null>(null);
  const conversationHistoryRef = useRef<ChatMessage[]>([]);

  const { isRecording, setMayaScreenActive, isProcessing, registerSession, clearSession } = useMayaRecording();

  // Handle viewport height adjustments when keyboard toggles
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Keep refs in sync with state
  useEffect(() => {
    businessIdRef.current = businessId;
  }, [businessId]);

  useEffect(() => {
    conversationHistoryRef.current = conversationHistory;
  }, [conversationHistory]);

  // Handle setting active state and session registration when focused
  useFocusEffect(
    useCallback(() => {
      setMayaScreenActive(true);
      registerSession({
        businessId: businessIdRef.current || '',
        conversationHistory: conversationHistoryRef,
        getToken,
        onResponse: handleVoiceResponse,
        onTranscript: handleVoiceTranscript,
        onError: handleVoiceError,
      });
      return () => {
        setMayaScreenActive(false);
        clearSession();
      };
    }, [setMayaScreenActive, registerSession, clearSession, getToken])
  );

  // Re-register session whenever businessId becomes available (it loads async)
  useEffect(() => {
    if (businessId) {
      registerSession({
        businessId,
        conversationHistory: conversationHistoryRef,
        getToken,
        onResponse: handleVoiceResponse,
        onTranscript: handleVoiceTranscript,
        onError: handleVoiceError,
      });
    }
  }, [businessId]);

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

  const handleVoiceTranscript = (transcript: string) => {
    // Step 1: Immediately show user's transcript bubble
    setMessages(prev => [...prev, {
      role: 'user',
      text: transcript,
    }]);

    // Step 2: Show thinking indicator (waiting on reasoning call)
    setIsThinking(true);
  };

  const handleVoiceResponse = (data: MayaResponse) => {
    const draft = data.current_draft || data.extracted_data || null;
    const userSpokenText = data.user_transcript || data.user_text || 'Voice message';

    // Step 2 has completed
    setIsThinking(false);

    // Reveal assistant reply immediately (natural network delay provided the gap)
    setMessages(prev => [...prev, {
      role: 'assistant',
      text: data.reply_text || '',
      draft: data.action_type === 'draft_invoice' ? draft : undefined,
      actionType: data.action_type || undefined,
    }]);

    // Update conversation history context
    setConversationHistory(prev => [
      ...prev,
      { role: 'user', content: userSpokenText },
      { role: 'assistant', content: data.reply_text || '' },
    ]);
  };

  const handleVoiceError = (errorType: 'permission' | 'network' | 'backend' | 'empty' | 'general', message: string) => {
    setIsThinking(false);
    let alertTitle = 'Error';
    if (errorType === 'permission') {
      alertTitle = 'Microphone Permission Denied';
    } else if (errorType === 'network') {
      alertTitle = 'Network Error';
    } else if (errorType === 'backend') {
      alertTitle = 'Maya Understanding Error';
    }
    Alert.alert(alertTitle, message);
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
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Could not process request';
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${detail}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = (draft: any) => {
    if (!draft) return;
    router.push({
      pathname: '/invoice/create',
      params: { maya_data: JSON.stringify(draft) },
    });
  };

  const handleCancelDraft = (index: number) => {
    // TODO: wire cancel action
    setMessages(prev => prev.map((m, idx) => idx === index ? { ...m, draft: undefined } : m));
  };

  const handleClearChat = () => {
    setMessages([]);
    setConversationHistory([]);
  };

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={styles.topbar}>
        <View style={styles.topbarRow}>
          <View>
            <Text style={styles.title}>Maya</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f97316' }} />
              <Text style={styles.subtitle}>Online · AI Voice Billing</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {messages.length > 0 && (
              <TouchableOpacity onPress={handleClearChat} style={styles.clearBtn}>
                <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.clearBtn}>
              <Ionicons name="close-outline" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainContainer}>
            {/* Empty state illustration/placeholder */}
            {messages.length === 0 && !isRecording && !isProcessing && !isThinking && !loading && (
              <View style={styles.emptyStateIllustrationContainer}>
                <View style={styles.emptyStateIconCircle}>
                  <Ionicons name="sparkles" size={48} color="#f97316" />
                </View>
                <Text style={styles.emptyStateTitle}>Bolo aur Bill Banao!</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Maya voice instructions aur typed messages dono samajhti hai. Niche diye gaye suggestion chip par tap karke dekhein.
                </Text>
              </View>
            )}

            {/* Chat messages list & indicators */}
            {(messages.length > 0 || isRecording || isProcessing || isThinking || loading) && (
              <View style={styles.chatContainer}>
                {messages.map((msg, i) => (
                  <View key={i} style={[styles.msgRow, msg.role === 'user' ? styles.msgRowUser : styles.msgRowAssistant]}>
                    <View style={[styles.msgBubble, msg.role === 'user' ? styles.msgBubbleUser : styles.msgBubbleAssistant]}>
                      <Text style={[styles.msgText, msg.role === 'user' && styles.msgTextUser]}>{msg.text}</Text>

                      {/* Draft invoice card */}
                      {msg.draft && msg.actionType === 'draft_invoice' && (() => {
                        const partyName = msg.draft.customer_name || 'Walk-in';
                        const getInitials = (name: string) => {
                          if (!name) return '??';
                          const parts = name.trim().split(/\s+/);
                          if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
                          return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
                        };
                        
                        return (
                          <View style={styles.draftCard}>
                            {/* Card Header */}
                            <View style={styles.draftCardHeader}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={styles.draftAvatar}>
                                  <Text style={styles.draftAvatarText}>{getInitials(partyName)}</Text>
                                </View>
                                <View>
                                  <Text style={styles.draftPartyName}>{partyName}</Text>
                                  <Text style={styles.draftDate}>{msg.draft.invoice_date || new Date().toISOString().split('T')[0]}</Text>
                                </View>
                              </View>
                              <View style={styles.draftBadge}>
                                <Text style={styles.draftBadgeText}>DRAFT</Text>
                              </View>
                            </View>

                            {/* Line Items */}
                            <View style={{ marginVertical: 8 }}>
                              {(msg.draft.items || []).map((item: any, j: number) => (
                                <View key={j} style={styles.draftItemRow}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.draftItemName}>{item.name || 'Item'}</Text>
                                    <Text style={styles.draftItemDetail}>
                                      {item.qty || item.quantity || 1} {item.unit || 'pcs'} x {fmt(item.rate || item.unit_price || 0)}
                                    </Text>
                                  </View>
                                  <Text style={styles.draftItemAmount}>
                                    {fmt((item.qty || item.quantity || 1) * (item.rate || item.unit_price || 0))}
                                  </Text>
                                </View>
                              ))}
                            </View>

                            {/* Total row */}
                            {msg.draft.total_amount && (
                              <View style={styles.draftTotalContainer}>
                                <Text style={styles.draftTotalLabel}>Total</Text>
                                <Text style={styles.draftTotalValue}>{fmt(msg.draft.total_amount)}</Text>
                              </View>
                            )}

                            {/* Action Buttons */}
                            <View style={styles.draftActionsRow}>
                              <TouchableOpacity style={styles.draftBtnOutline} onPress={() => handleCancelDraft(i)}>
                                {/* TODO: wire cancel action */}
                                <Text style={styles.draftBtnOutlineText}>Cancel</Text>
                              </TouchableOpacity>
                              
                              <TouchableOpacity style={styles.draftBtnOutline} onPress={() => {}}>
                                {/* TODO: wire edit action, not yet implemented. */}
                                <Text style={styles.draftBtnOutlineText}>Edit</Text>
                              </TouchableOpacity>

                              <TouchableOpacity style={styles.draftBtnSolid} onPress={() => handleCreateInvoice(msg.draft)}>
                                <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 4 }} />
                                <Text style={styles.draftBtnSolidText}>Create Bill</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })()}
                    </View>
                  </View>
                ))}

                {/* Passive status indicator at the bottom of message history when recording */}
                {isRecording && (
                  <View style={[styles.msgRow, styles.msgRowAssistant]}>
                    <View style={[styles.msgBubble, styles.msgBubbleAssistant, { backgroundColor: '#fff7ed', borderColor: '#f9731640' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                        <Text style={[styles.msgText, { color: Colors.primary, fontWeight: '500' }]}>Listening...</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Processing indicator (backend round-trip for voice) */}
                {isProcessing && (
                  <View style={[styles.msgRow, styles.msgRowAssistant]}>
                    <View style={[styles.msgBubble, styles.msgBubbleAssistant, { backgroundColor: '#fff7ed', borderColor: '#f9731640' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                        <Text style={[styles.msgText, { color: Colors.primary, fontWeight: '500' }]}>Processing your voice...</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Typed loading indicator (backend round-trip for text) */}
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

                {/* Thinking indicator (400ms gap between transcript and reply) */}
                {isThinking && !isProcessing && !loading && (
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
              </View>
            )}
          </View>
        </ScrollView>

        {/* Suggestion Chips placed directly above composer */}
        {messages.length === 0 && !isRecording && !isProcessing && !isThinking && !loading && (
          <View style={styles.suggestionChipsContainer}>
            <Text style={styles.suggestionChipsTitle}>Try saying:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionChipsScroll}>
              {[
                '"Create invoice for Rajesh 5 steel pipes at 4200 each"',
                '"Bill Sunita Traders 10 bags cement 350 per bag GST 28%"',
                '"Invoice for Pawan 2 hours labour 1500 per hour"',
              ].map((ex, i) => (
                <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => setManualInput(ex.replace(/"/g, ''))}>
                  <Text style={styles.suggestionChipText}>{ex.replace(/"/g, '')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input bar — text only, mic is on the tab bar */}
        <View style={styles.inputBar}>
          <View style={styles.textInputWrapper}>
            <TextInput
              style={styles.textInput}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Type a message..."
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
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <Ionicons name="arrow-up" size={20} color={manualInput.trim() ? '#f97316' : '#9ca3af'} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
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
  subtitle: { fontSize: 12, color: Colors.textMuted },
  clearBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  content: {
    paddingBottom: 48,
  },
  mainContainer: {
    paddingVertical: 16,
  },
  emptyStateContainer: {
    justifyContent: 'center',
    paddingVertical: 12,
  },
  chatContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyStateIllustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 40,
    marginBottom: 20,
  },
  emptyStateIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Suggestion Chips
  suggestionChipsContainer: {
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  suggestionChipsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 16,
    marginBottom: 6,
  },
  suggestionChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#fff7ed',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: '#fed7aa',
  },
  suggestionChipText: {
    color: '#ea580c',
    fontSize: 13,
    fontWeight: '500',
  },

  // Chat messages
  msgRow: {
    marginBottom: 12,
    width: '100%',
  },
  msgRowUser: {
    alignItems: 'flex-end',
  },
  msgRowAssistant: {
    alignItems: 'flex-start',
  },
  msgBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    flexShrink: 1,
  },
  msgBubbleUser: {
    backgroundColor: '#f97316', // Solid orange User messages
    borderBottomRightRadius: 16,
  },
  msgBubbleAssistant: {
    backgroundColor: '#f3f4f6', // Light gray background Assistant messages
    borderBottomLeftRadius: 16,
  },
  msgText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  msgTextUser: {
    color: '#fff',
  },

  // Restyled Draft Summary Card
  draftCard: {
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    width: '100%',
    minWidth: 260,
  },
  draftCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  draftAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftAvatarText: {
    color: '#ea580c',
    fontWeight: 'bold',
    fontSize: 12,
  },
  draftPartyName: {
    fontWeight: 'bold',
    color: '#0f172a',
    fontSize: 13,
  },
  draftDate: {
    color: '#6b7280',
    fontSize: 11,
  },
  draftBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  draftBadgeText: {
    color: '#ea580c',
    fontWeight: 'bold',
    fontSize: 10,
  },
  draftItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
  },
  draftItemName: {
    fontWeight: '600',
    color: '#1e293b',
    fontSize: 12,
  },
  draftItemDetail: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 2,
  },
  draftItemAmount: {
    fontWeight: '700',
    color: '#0f172a',
    fontSize: 12,
  },
  draftTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 6,
    marginTop: 6,
    marginBottom: 12,
    alignItems: 'center',
  },
  draftTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  draftTotalValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f97316',
  },
  draftActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  draftBtnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBtnOutlineText: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '600',
  },
  draftBtnSolid: {
    flex: 1.5,
    backgroundColor: '#f97316',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  draftBtnSolidText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Typing indicator dots
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f97316',
  },

  // Bottom Input Bar
  inputBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#f3f4f6',
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  textInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: Colors.border,
    alignItems: 'center',
    paddingRight: 6,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text,
    height: 40,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
