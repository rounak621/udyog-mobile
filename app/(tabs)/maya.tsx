import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ScrollView, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { useMayaRecording } from '../../context/MayaRecordingContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UIMessage {
  role: 'user' | 'assistant';
  text: string;
  draft?: any;
  actionType?: string;
  time?: string;
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

function OrangeGradientBadge({
  size = 76,
  borderRadius = 22,
  iconSize = 36,
  iconName = 'sparkles',
}: {
  size?: number;
  borderRadius?: number;
  iconSize?: number;
  iconName?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FB923C" />
            <Stop offset="60%" stopColor="#F97316" />
            <Stop offset="100%" stopColor="#EA580C" />
          </LinearGradient>
        </Defs>
        <Rect width={size} height={size} rx={borderRadius} fill="url(#orangeGrad)" />
      </Svg>
      <Ionicons name={iconName as any} size={iconSize} color="#FFFFFF" />
    </View>
  );
}

function MayaAvatar({ size = 28 }: { size?: number }) {
  const borderRadius = size / 2;
  const iconSize = Math.round(size * 0.52);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="mayaAvatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FB923C" />
            <Stop offset="100%" stopColor="#EA580C" />
          </LinearGradient>
        </Defs>
        <Rect width={size} height={size} rx={borderRadius} fill="url(#mayaAvatarGrad)" />
      </Svg>
      <Ionicons name="sparkles" size={iconSize} color="#FFFFFF" />
    </View>
  );
}

export default function MayaScreen() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  
  const scrollRef = useRef<ScrollView>(null);

  // Live refs so the registered session always reads fresh values
  const businessIdRef = useRef<string | null>(null);
  const conversationHistoryRef = useRef<ChatMessage[]>([]);
  const tailBufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    isRecording,
    setMayaScreenActive,
    isProcessing,
    registerSession,
    clearSession,
    startRecording,
    stopRecording,
  } = useMayaRecording();

  // Cleanup tail buffer timer on unmount
  useEffect(() => {
    return () => {
      if (tailBufferTimerRef.current) {
        clearTimeout(tailBufferTimerRef.current);
      }
    };
  }, []);

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

  const getTimeString = () =>
    new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

  const handleVoiceTranscript = (transcript: string) => {
    // Step 1: Immediately show user's transcript bubble
    setMessages(prev => [
      ...prev,
      {
        role: 'user',
        text: transcript,
        time: getTimeString(),
      },
    ]);

    // Step 2: Show thinking indicator (waiting on reasoning call)
    setIsThinking(true);
  };

  const handleEditDraftResponse = (data: MayaResponse) => {
    setIsThinking(false);
    const { field, item_name, new_value } = data.extracted_data || {};

    setMessages(prev => {
      const draftIndex = prev.map(m => !!m.draft).lastIndexOf(true);
      if (draftIndex === -1) {
        return [
          ...prev,
          {
            role: 'assistant',
            text: 'No active draft to edit.',
          },
        ];
      }

      const targetMsg = prev[draftIndex];
      const draft = JSON.parse(JSON.stringify(targetMsg.draft));

      if (field === 'rate' && item_name) {
        if (Array.isArray(draft.items)) {
          draft.items = draft.items.map((it: any) => {
            if (it.name?.toLowerCase().includes(item_name.toLowerCase())) {
              const newRate = Number(new_value);
              const qty = Number(it.qty || it.quantity || 1);
              return {
                ...it,
                rate: newRate,
                unit_price: newRate,
                amount: qty * newRate,
              };
            }
            return it;
          });
        }
      } else if (field === 'quantity' && item_name) {
        if (Array.isArray(draft.items)) {
          draft.items = draft.items.map((it: any) => {
            if (it.name?.toLowerCase().includes(item_name.toLowerCase())) {
              const newQty = Number(new_value);
              const rate = Number(it.rate || it.unit_price || 0);
              return {
                ...it,
                qty: newQty,
                quantity: newQty,
                amount: newQty * rate,
              };
            }
            return it;
          });
        }
      } else if (field === 'customer_name' || field === 'party_name') {
        draft.customer_name = String(new_value);
        draft.party_name = String(new_value);
      } else if (field === 'hsn_code' && item_name) {
        if (Array.isArray(draft.items)) {
          draft.items = draft.items.map((it: any) => {
            if (it.name?.toLowerCase().includes(item_name.toLowerCase())) {
              return { ...it, hsn_code: String(new_value) };
            }
            return it;
          });
        }
      } else if ((field === 'tax_rate' || field === 'gst_rate') && item_name) {
        if (Array.isArray(draft.items)) {
          draft.items = draft.items.map((it: any) => {
            if (it.name?.toLowerCase().includes(item_name.toLowerCase())) {
              return { ...it, tax_rate: Number(new_value), gst_rate: Number(new_value) };
            }
            return it;
          });
        }
      } else if (field === 'start_date') {
        draft.start_date = String(new_value);
      } else if (field === 'end_date') {
        draft.end_date = String(new_value);
      } else if (field === 'rate_type') {
        draft.rate_type = String(new_value);
      }

      if (Array.isArray(draft.items)) {
        draft.total_amount = draft.items.reduce((sum: number, it: any) => {
          const qty = Number(it.qty || it.quantity || 1);
          const rate = Number(it.rate || it.unit_price || 0);
          return sum + (it.amount !== undefined ? Number(it.amount) : qty * rate);
        }, 0);
      }

      const updated = [...prev];
      updated[draftIndex] = {
        ...targetMsg,
        draft,
      };
      updated.push({
        role: 'assistant',
        text: data.reply_text || 'Updated! Check karo.',
        time: getTimeString(),
      });
      return updated;
    });

    const userSpokenText = data.user_transcript || data.user_text || '';
    if (userSpokenText) {
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: userSpokenText },
        { role: 'assistant', content: data.reply_text || 'Updated! Check karo.' },
      ]);
    }
  };

  const handleVoiceResponse = (data: MayaResponse) => {
    if (data.action_type === 'edit_draft') {
      handleEditDraftResponse(data);
      return;
    }

    let draft = null;
    if (data.action_type === 'draft_invoice') {
      draft = data.current_draft || data.extracted_data || null;
    } else if (data.action_type === 'draft_rental') {
      draft = data.extracted_data || data.current_draft || null;
      if (draft) draft.is_rental = true;
    } else if (data.action_type === 'create_customer') {
      draft = data.extracted_data?.new_party || null;
    } else if (data.action_type === 'create_item') {
      draft = data.extracted_data?.new_item || null;
    }
    const userSpokenText = data.user_transcript || data.user_text || 'Voice message';

    // Step 2 has completed
    setIsThinking(false);

    // Reveal assistant reply immediately (natural network delay provided the gap)
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        text: data.reply_text || '',
        draft: draft || undefined,
        actionType: data.action_type || undefined,
        time: getTimeString(),
      },
    ]);

    // Update conversation history context
    setConversationHistory(prev => [
      ...prev,
      { role: 'user', content: userSpokenText },
      { role: 'assistant', content: data.reply_text || '' },
    ]);

    triggerNavigationWithDelay(data);
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

  const triggerNavigationWithDelay = (data: MayaResponse) => {
    const actionType = data.action_type || data.intent;
    const normalizedAction = actionType?.toLowerCase();

    setTimeout(() => {
      if (normalizedAction === 'check_balance') {
        const partyId = data.extracted_data?.party_id;
        if (partyId) {
          router.push(`/party/${partyId}?tab=khata`);
        } else {
          router.push('/(tabs)/parties');
        }
      } else if (normalizedAction === 'show_party_bills') {
        const partyId = data.extracted_data?.party_id;
        if (partyId) {
          router.push(`/party/${partyId}?tab=bills`);
        } else {
          router.push('/(tabs)/parties');
        }
      } else if (normalizedAction === 'show_bills_summary') {
        router.push('/(tabs)/bills');
      } else if (normalizedAction === 'show_purchase_summary') {
        router.push('/purchase-bills');
      } else if (data.navigation_route) {
        const routeMap: { [key: string]: string } = {
          '/dashboard': '/(tabs)',
          '/reports': '/reports',
          '/bills': '/(tabs)/bills',
          '/parties': '/(tabs)/parties',
          '/items': '/items',
          '/purchases': '/purchase-bills',
          '/settings': '/(tabs)/more',
          '/rentals': '/(rental)/overview',
        };
        const mappedRoute = routeMap[data.navigation_route];
        if (mappedRoute) {
          router.push(mappedRoute as any);
        }
      }
    }, 800);
  };

  const handleSendQuery = async (queryText: string) => {
    const text = queryText.trim();
    if (!text || !businessIdRef.current || loading) return;

    setLoading(true);
    const time = getTimeString();

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', text, time }]);

    try {
      const token = await getToken();
      setAuthToken(token);

      // Build multipart/form-data
      const formData = new FormData();
      formData.append('business_id', businessIdRef.current);
      formData.append('text', text);
      formData.append('conversation_history', JSON.stringify(conversationHistoryRef.current));

      const res = await api.post('/ai/maya-chat', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      const data: MayaResponse = res.data;

      if (data.action_type === 'edit_draft') {
        handleEditDraftResponse(data);
        return;
      }

      // Extract draft based on action_type
      let draft = null;
      if (data.action_type === 'draft_invoice') {
        draft = data.current_draft || data.extracted_data || null;
      } else if (data.action_type === 'draft_rental') {
        draft = data.extracted_data || data.current_draft || null;
        if (draft) draft.is_rental = true;
      } else if (data.action_type === 'create_customer') {
        draft = data.extracted_data?.new_party || null;
      } else if (data.action_type === 'create_item') {
        draft = data.extracted_data?.new_item || null;
      }

      // Add assistant message
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: data.reply_text || '',
          draft: draft || undefined,
          actionType: data.action_type || undefined,
          time: getTimeString(),
        },
      ]);

      // Update conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: data.reply_text || '' },
      ]);

      triggerNavigationWithDelay(data);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Could not process request';
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: `Error: ${detail}`, time: getTimeString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendText = async () => {
    const text = manualInput.trim();
    if (!text) return;
    setManualInput('');
    await handleSendQuery(text);
  };

  const handleMicPressIn = () => {
    if (tailBufferTimerRef.current) {
      clearTimeout(tailBufferTimerRef.current);
      tailBufferTimerRef.current = null;
    }
    startRecording();
  };

  const handleMicPressOut = () => {
    tailBufferTimerRef.current = setTimeout(() => {
      stopRecording();
      tailBufferTimerRef.current = null;
    }, 400);
  };

  const handleCreateInvoice = (draft: any) => {
    if (!draft) return;
    router.push({
      pathname: '/invoice/create',
      params: { maya_data: JSON.stringify(draft) },
    });
  };

  const handleCreateRental = (draft: any) => {
    if (!draft) return;
    router.push({
      pathname: '/rental-order/create',
      params: { maya_data: JSON.stringify(draft) },
    });
  };

  const handleCancelDraft = (index: number) => {
    // TODO: wire cancel action
    setMessages(prev => prev.map((m, idx) => idx === index ? { ...m, draft: undefined } : m));
  };

  const handleEditCustomer = (draft: any, index: number) => {
    router.push({
      pathname: '/party/create',
      params: {
        name: draft.name || '',
        phone: draft.phone || '',
        gstin: draft.gstin || '',
        state: draft.state || '',
        partyType: draft.party_type || 'customer',
      }
    });
    setMessages(prev => prev.map((m, idx) => idx === index ? { ...m, draft: undefined } : m));
  };

  const handleEditItem = (draft: any, index: number) => {
    router.push({
      pathname: '/items/create',
      params: {
        name: draft.name || '',
        rate: draft.price ? String(draft.price) : '',
        gstRate: draft.gst_rate ? String(draft.gst_rate) : '',
        hsnCode: draft.hsn_code || '',
        unit: draft.unit || 'PCS',
      }
    });
    setMessages(prev => prev.map((m, idx) => idx === index ? { ...m, draft: undefined } : m));
  };

  const confirmCreateParty = async (draft: any, index: number) => {
    if (!draft || !businessId) return;
    try {
      const token = await getToken();
      setAuthToken(token);

      const response = await api.post('/ai/maya-create-party', {
        business_id: businessId,
        party_data: draft
      });

      if (response.data.success) {
        // Close card
        setMessages(prev => prev.map((m, idx) => idx === index ? { ...m, draft: undefined } : m));
        // Append helper success message
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: `Party "${draft.name}" successfully add ho gayi!`
        }]);
        setConversationHistory(prev => [
          ...prev,
          { role: 'assistant', content: `Party "${draft.name}" successfully add ho gayi!` }
        ]);
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Party create karne mein error aaya';
      Alert.alert('Error', msg);
    }
  };

  const confirmCreateItem = async (draft: any, index: number) => {
    if (!draft || !businessId) return;
    try {
      const token = await getToken();
      setAuthToken(token);

      const response = await api.post('/ai/maya-create-item', {
        business_id: businessId,
        item_data: draft
      });

      if (response.data.success) {
        // Close card
        setMessages(prev => prev.map((m, idx) => idx === index ? { ...m, draft: undefined } : m));
        // Append helper success message
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: `Item "${draft.name}" successfully add ho gaya!`
        }]);
        setConversationHistory(prev => [
          ...prev,
          { role: 'assistant', content: `Item "${draft.name}" successfully add ho gaya!` }
        ]);
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Item create karne mein error aaya';
      Alert.alert('Error', msg);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setConversationHistory([]);
  };

  const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      {/* Header */}
      <View style={[styles.topbar, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <View style={styles.topbarRow}>
          <View>
            <Text style={styles.title}>Maya</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <View style={styles.onlineDot} />
              <Text style={styles.subtitle}>Online · AI Voice</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {messages.length > 0 && (
              <TouchableOpacity onPress={handleClearChat} style={styles.headerIconBtn}>
                <Ionicons name="trash-outline" size={18} color="#64748B" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.headerIconBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
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
            {/* Empty state illustration & vertically stacked suggestion chips */}
            {messages.length === 0 && !isRecording && !isProcessing && !isThinking && !loading && (
              <View style={styles.emptyStateContainer}>
                <View style={styles.badgeGlowWrapper}>
                  <View style={styles.badgeGlowBackdrop} />
                  <OrangeGradientBadge size={76} borderRadius={22} iconSize={36} iconName="sparkles" />
                </View>
                <Text style={styles.emptyStateTitle}>Bolo aur Bill Banao!</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Voice se bill banao, customer add karo, ya hisaab dekho.
                </Text>

                <View style={styles.suggestionSection}>
                  <Text style={styles.suggestionLabel}>TRY SAYING</Text>
                  <View style={styles.suggestionList}>
                    {[
                      'Invoice banao Rajesh ke liye',
                      'Bill summary dikhao',
                      'Aaj ke pending bills',
                      'Customer add karo',
                      'GST report download',
                    ].map((example, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.suggestionPill}
                        onPress={() => handleSendQuery(example)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="mic-outline" size={16} color="#EA580C" />
                        <Text style={styles.suggestionPillText}>{example}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Chat messages list & indicators */}
            {(messages.length > 0 || isRecording || isProcessing || isThinking || loading) && (
              <View style={styles.chatContainer}>
                {messages.map((msg, i) => {
                  const hasText = !!(msg.text && msg.text.trim().length > 0);
                  const hasInvoiceDraft = !!(msg.draft && msg.actionType === 'draft_invoice');
                  const hasRentalDraft = !!(msg.draft && msg.actionType === 'draft_rental');
                  const hasCustomerDraft = !!(msg.draft && msg.actionType === 'create_customer');
                  const hasItemDraft = !!(msg.draft && msg.actionType === 'create_item');
                  const hasAnyCard = hasInvoiceDraft || hasRentalDraft || hasCustomerDraft || hasItemDraft;

                  if (!hasText && !hasAnyCard) return null;

                  const showTimestamp = !!msg.time && (i === 0 || messages[i - 1]?.role !== msg.role);

                  const renderRentalDraftCard = (isStandalone: boolean) => {
                    const partyName = msg.draft.customer_name || msg.draft.party_name || 'Walk-in';
                    const getInitials = (name: string) => {
                      if (!name) return '??';
                      const parts = name.trim().split(/\s+/);
                      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
                      return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
                    };

                    return (
                      <View style={[styles.draftCard, isStandalone && { marginTop: 0 }]}>
                        {/* Card Header */}
                        <View style={styles.draftCardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={styles.draftAvatar}>
                              <Text style={styles.draftAvatarText}>{getInitials(partyName)}</Text>
                            </View>
                            <View>
                              <Text style={styles.draftPartyName}>{partyName}</Text>
                              <Text style={styles.draftDate}>
                                {msg.draft.start_date || 'Today'}{msg.draft.end_date ? ` to ${msg.draft.end_date}` : ''}
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.draftBadge, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', borderWidth: 1 }]}>
                            <Text style={[styles.draftBadgeText, { color: '#F97316' }]}>RENTAL</Text>
                          </View>
                        </View>

                        {/* Line Items */}
                        <View style={{ marginVertical: 8 }}>
                          {(msg.draft.items || []).map((item: any, j: number) => (
                            <View key={j} style={styles.draftItemRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.draftItemName}>{item.name || 'Rental Item'}</Text>
                                <Text style={styles.draftItemDetail}>
                                  {item.qty || item.quantity || 1} {item.unit || 'pcs'} x {fmt(item.rate || item.unit_price || 0)} {item.rate_type ? `/${item.rate_type}` : ''}
                                </Text>
                              </View>
                              <Text style={styles.draftItemAmount}>
                                {fmt((item.qty || item.quantity || 1) * (item.rate || item.unit_price || 0))}
                              </Text>
                            </View>
                          ))}
                        </View>

                        {/* Total row */}
                        {msg.draft.total_amount ? (
                          <View style={styles.draftTotalContainer}>
                            <Text style={styles.draftTotalLabel}>Total</Text>
                            <Text style={styles.draftTotalValue}>{fmt(msg.draft.total_amount)}</Text>
                          </View>
                        ) : null}

                        {/* Action Buttons */}
                        <View style={styles.draftActionsRow}>
                          <TouchableOpacity style={styles.draftBtnOutline} onPress={() => handleCancelDraft(i)}>
                            <Text style={styles.draftBtnOutlineText}>Cancel</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity style={styles.draftBtnOutline} onPress={() => handleCreateRental(msg.draft)}>
                            <Text style={styles.draftBtnOutlineText}>Edit</Text>
                          </TouchableOpacity>

                          <TouchableOpacity style={styles.draftBtnSolid} onPress={() => handleCreateRental(msg.draft)}>
                            <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.draftBtnSolidText}>Create Rental</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  };

                  const renderCustomerCard = (isStandalone: boolean) => {
                    const partyName = msg.draft.name || 'New Party';
                    const getInitials = (name: string) => {
                      if (!name) return '??';
                      const parts = name.trim().split(/\s+/);
                      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
                      return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
                    };

                    return (
                      <View style={[styles.draftCard, isStandalone && { marginTop: 0 }]}>
                        {/* Card Header */}
                        <View style={styles.draftCardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={styles.draftAvatar}>
                              <Text style={styles.draftAvatarText}>{getInitials(partyName)}</Text>
                            </View>
                            <View>
                              <Text style={styles.draftPartyName}>{partyName}</Text>
                              <Text style={styles.draftDate}>Party Draft</Text>
                            </View>
                          </View>
                          <View style={[styles.draftBadge, { backgroundColor: '#EFF6FF' }]}>
                            <Text style={[styles.draftBadgeText, { color: '#2563EB' }]}>NEW PARTY</Text>
                          </View>
                        </View>

                        {/* Details Fields */}
                        <View style={{ marginVertical: 8, gap: 4 }}>
                          {msg.draft.phone ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>Phone</Text>
                              <Text style={{ fontSize: 12, color: '#0F172A', fontWeight: '500' }}>{msg.draft.phone}</Text>
                            </View>
                          ) : null}
                          {msg.draft.gstin ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>GSTIN</Text>
                              <Text style={{ fontSize: 12, color: '#0F172A', fontWeight: '500' }}>{msg.draft.gstin}</Text>
                            </View>
                          ) : null}
                          {msg.draft.state ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>State</Text>
                              <Text style={{ fontSize: 12, color: '#0F172A', fontWeight: '500' }}>{msg.draft.state}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.draftActionsRow}>
                          <TouchableOpacity style={styles.draftBtnOutline} onPress={() => handleCancelDraft(i)}>
                            <Text style={styles.draftBtnOutlineText}>Cancel</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity style={styles.draftBtnOutline} onPress={() => handleEditCustomer(msg.draft, i)}>
                            <Text style={styles.draftBtnOutlineText}>Edit</Text>
                          </TouchableOpacity>

                          <TouchableOpacity style={styles.draftBtnSolid} onPress={() => confirmCreateParty(msg.draft, i)}>
                            <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.draftBtnSolidText}>Party Banao</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  };

                  const renderItemCard = (isStandalone: boolean) => {
                    const itemName = msg.draft.name || 'New Item';
                    const getInitials = (name: string) => {
                      if (!name) return '??';
                      const parts = name.trim().split(/\s+/);
                      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
                      return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
                    };

                    return (
                      <View style={[styles.draftCard, isStandalone && { marginTop: 0 }]}>
                        {/* Card Header */}
                        <View style={styles.draftCardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={styles.draftAvatar}>
                              <Text style={styles.draftAvatarText}>{getInitials(itemName)}</Text>
                            </View>
                            <View>
                              <Text style={styles.draftPartyName}>{itemName}</Text>
                              <Text style={styles.draftDate}>Item Draft</Text>
                            </View>
                          </View>
                          <View style={[styles.draftBadge, { backgroundColor: '#F0FDF4' }]}>
                            <Text style={[styles.draftBadgeText, { color: '#16A34A' }]}>NEW ITEM</Text>
                          </View>
                        </View>

                        {/* Details Fields */}
                        <View style={{ marginVertical: 8, gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>Price</Text>
                            <Text style={{ fontSize: 12, color: '#0F172A', fontWeight: '500' }}>₹{msg.draft.price || 0}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>GST Rate</Text>
                            <Text style={{ fontSize: 12, color: '#0F172A', fontWeight: '500' }}>{msg.draft.gst_rate || 0}%</Text>
                          </View>
                          {msg.draft.hsn_code ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>HSN Code</Text>
                              <Text style={{ fontSize: 12, color: '#0F172A', fontWeight: '500' }}>{msg.draft.hsn_code}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.draftActionsRow}>
                          <TouchableOpacity style={styles.draftBtnOutline} onPress={() => handleCancelDraft(i)}>
                            <Text style={styles.draftBtnOutlineText}>Cancel</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity style={styles.draftBtnOutline} onPress={() => handleEditItem(msg.draft, i)}>
                            <Text style={styles.draftBtnOutlineText}>Edit</Text>
                          </TouchableOpacity>

                          <TouchableOpacity style={styles.draftBtnSolid} onPress={() => confirmCreateItem(msg.draft, i)}>
                            <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.draftBtnSolidText}>Item Banao</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  };

                  const renderDraftCard = (isStandalone: boolean) => {
                    const partyName = msg.draft.customer_name || 'Walk-in';
                    const getInitials = (name: string) => {
                      if (!name) return '??';
                      const parts = name.trim().split(/\s+/);
                      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
                      return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
                    };

                    return (
                      <View style={[styles.draftCard, isStandalone && { marginTop: 0 }]}>
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
                            <Text style={styles.draftBtnOutlineText}>Cancel</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity style={styles.draftBtnOutline} onPress={() => handleCreateInvoice(msg.draft)}>
                            <Text style={styles.draftBtnOutlineText}>Edit</Text>
                          </TouchableOpacity>

                          <TouchableOpacity style={styles.draftBtnSolid} onPress={() => handleCreateInvoice(msg.draft)}>
                            <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.draftBtnSolidText}>Create Bill</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  };

                  return (
                    <View key={i} style={styles.messageTurnWrapper}>
                      {showTimestamp && (
                        <View style={styles.timestampRow}>
                          <View style={styles.timestampLine} />
                          <Text style={styles.timestampText}>{msg.time}</Text>
                          <View style={styles.timestampLine} />
                        </View>
                      )}

                      {msg.role === 'user' ? (
                        <View style={styles.userMessageRow}>
                          <View style={styles.userBubble}>
                            <Text style={styles.userMessageText}>{msg.text}</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.assistantMessageRow}>
                          <View style={styles.assistantAvatarWrap}>
                            <MayaAvatar size={28} />
                          </View>
                          <View style={styles.assistantContentWrap}>
                            {hasText && (
                              <View style={styles.assistantBubble}>
                                <Text style={styles.assistantMessageText}>{msg.text}</Text>
                              </View>
                            )}
                            {hasInvoiceDraft && renderDraftCard(!hasText)}
                            {hasRentalDraft && renderRentalDraftCard(!hasText)}
                            {hasCustomerDraft && renderCustomerCard(!hasText)}
                            {hasItemDraft && renderItemCard(!hasText)}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Status indicator when recording */}
                {isRecording && (
                  <View style={styles.messageTurnWrapper}>
                    <View style={styles.assistantMessageRow}>
                      <View style={styles.assistantAvatarWrap}>
                        <MayaAvatar size={28} />
                      </View>
                      <View style={[styles.assistantBubble, styles.listeningBubble]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <ActivityIndicator size="small" color="#EA580C" />
                          <Text style={[styles.assistantMessageText, { color: '#EA580C', fontWeight: '600' }]}>
                            Listening...
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* Processing indicator */}
                {isProcessing && (
                  <View style={styles.messageTurnWrapper}>
                    <View style={styles.assistantMessageRow}>
                      <View style={styles.assistantAvatarWrap}>
                        <MayaAvatar size={28} />
                      </View>
                      <View style={[styles.assistantBubble, styles.listeningBubble]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <ActivityIndicator size="small" color="#EA580C" />
                          <Text style={[styles.assistantMessageText, { color: '#EA580C', fontWeight: '600' }]}>
                            Processing your voice...
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* Typed loading or thinking indicator */}
                {(loading || (isThinking && !isProcessing)) && (
                  <View style={styles.messageTurnWrapper}>
                    <View style={styles.assistantMessageRow}>
                      <View style={styles.assistantAvatarWrap}>
                        <MayaAvatar size={28} />
                      </View>
                      <View style={styles.assistantBubble}>
                        <View style={styles.dotsRow}>
                          <PulsingDot delay={0} />
                          <PulsingDot delay={200} />
                          <PulsingDot delay={400} />
                        </View>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: (Platform.OS === 'ios' ? 20 : 12) + insets.bottom }]}>
          <View style={styles.textInputWrapper}>
            <TextInput
              style={styles.textInput}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Type a message..."
              placeholderTextColor="#94A3B8"
              editable={!!businessId && !loading}
              onSubmitEditing={handleSendText}
              returnKeyType="send"
            />
          </View>
          <TouchableOpacity
            style={[
              styles.circleActionBtn,
              isRecording && styles.circleActionBtnRecording,
              manualInput.trim().length > 0 && styles.circleActionBtnSend,
              (loading || !businessId) && styles.circleActionBtnDisabled,
            ]}
            onPress={manualInput.trim().length > 0 ? handleSendText : undefined}
            onPressIn={manualInput.trim().length === 0 ? handleMicPressIn : undefined}
            onPressOut={manualInput.trim().length === 0 ? handleMicPressOut : undefined}
            disabled={loading || !businessId}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : manualInput.trim().length > 0 ? (
              <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
            ) : (
              <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={22} color="#FFFFFF" />
            )}
          </TouchableOpacity>
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  topbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    paddingBottom: 24,
  },
  mainContainer: {
    paddingVertical: 12,
  },

  // Empty State Styles
  emptyStateContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 24,
  },
  badgeGlowWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  badgeGlowBackdrop: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 30,
  },
  suggestionSection: {
    width: '100%',
    marginTop: 6,
  },
  suggestionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 14,
  },
  suggestionList: {
    width: '100%',
    gap: 10,
  },
  suggestionPill: {
    width: '100%',
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 13,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  suggestionPillText: {
    color: '#EA580C',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },

  // Chat Container Styles
  chatContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  messageTurnWrapper: {
    marginBottom: 16,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    gap: 10,
  },
  timestampLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: '#E2E8F0',
  },
  timestampText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  userMessageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },
  userBubble: {
    backgroundColor: '#F97316',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '82%',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  userMessageText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  assistantMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  assistantAvatarWrap: {
    marginTop: 2,
  },
  assistantContentWrap: {
    flex: 1,
    maxWidth: '84%',
  },
  assistantBubble: {
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  listeningBubble: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  assistantMessageText: {
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 20,
  },

  // Restyled Draft Summary Card
  draftCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftAvatarText: {
    color: '#EA580C',
    fontWeight: 'bold',
    fontSize: 12,
  },
  draftPartyName: {
    fontWeight: 'bold',
    color: '#0F172A',
    fontSize: 13,
  },
  draftDate: {
    color: '#6B7280',
    fontSize: 11,
  },
  draftBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  draftBadgeText: {
    color: '#EA580C',
    fontWeight: 'bold',
    fontSize: 10,
  },
  draftItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  draftItemName: {
    fontWeight: '600',
    color: '#1E293B',
    fontSize: 12,
  },
  draftItemDetail: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  draftItemAmount: {
    fontWeight: '700',
    color: '#0F172A',
    fontSize: 12,
  },
  draftTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 6,
    marginTop: 6,
    marginBottom: 12,
    alignItems: 'center',
  },
  draftTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  draftTotalValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F97316',
  },
  draftActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  draftBtnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBtnOutlineText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },
  draftBtnSolid: {
    flex: 1.5,
    backgroundColor: '#F97316',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  draftBtnSolidText: {
    color: '#FFFFFF',
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
    backgroundColor: '#F97316',
  },

  // Bottom Input Bar
  inputBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
    gap: 10,
  },
  textInputWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    height: 46,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
    color: '#0F172A',
    height: 40,
    paddingVertical: 0,
  },
  circleActionBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  circleActionBtnRecording: {
    backgroundColor: '#EA580C',
    transform: [{ scale: 1.05 }],
  },
  circleActionBtnSend: {
    backgroundColor: '#F97316',
  },
  circleActionBtnDisabled: {
    opacity: 0.5,
  },
});
