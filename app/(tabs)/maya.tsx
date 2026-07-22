import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ScrollView, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, Keyboard
} from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
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
  const { user } = useUser();
  const userInitial = user?.firstName?.[0]?.toUpperCase() || user?.fullName?.[0]?.toUpperCase() || 'U';
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
    setMessages(prev => [...prev, {
      role: 'assistant',
      text: data.reply_text || '',
      draft: draft || undefined,
      actionType: data.action_type || undefined,
    }]);

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
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.reply_text || '',
        draft: draft || undefined,
        actionType: data.action_type || undefined,
      }]);

      // Update conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: data.reply_text || '' },
      ]);

      triggerNavigationWithDelay(data);
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
                {messages.map((msg, i) => {
                  const hasText = !!(msg.text && msg.text.trim().length > 0);
                  const hasInvoiceDraft = !!(msg.draft && msg.actionType === 'draft_invoice');
                  const hasRentalDraft = !!(msg.draft && msg.actionType === 'draft_rental');
                  const hasCustomerDraft = !!(msg.draft && msg.actionType === 'create_customer');
                  const hasItemDraft = !!(msg.draft && msg.actionType === 'create_item');
                  const hasAnyCard = hasInvoiceDraft || hasRentalDraft || hasCustomerDraft || hasItemDraft;

                  if (!hasText && !hasAnyCard) return null;

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

                  if (msg.role === 'user') {
                    return (
                      <View key={i} style={styles.msgRowUserContainer}>
                        {hasText && (
                          <View style={{ flexShrink: 1, maxWidth: '82%' }}>
                            <View style={[styles.msgBubble, styles.msgBubbleUser]}>
                              <Text style={[styles.msgText, styles.msgTextUser]}>{msg.text}</Text>
                            </View>
                          </View>
                        )}
                        <View style={styles.userAvatar}>
                          <Text style={styles.userAvatarText}>{userInitial}</Text>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View key={i} style={styles.msgRowAssistantContainer}>
                      <View style={styles.assistantAvatar}>
                        <Ionicons name="sparkles" size={15} color="#f97316" />
                      </View>
                      <View style={{ flexShrink: 1, maxWidth: '82%' }}>
                        {hasText ? (
                          <View style={[styles.msgBubble, styles.msgBubbleAssistant]}>
                            <Text style={styles.msgText}>{msg.text}</Text>
                            {hasInvoiceDraft && renderDraftCard(false)}
                            {hasRentalDraft && renderRentalDraftCard(false)}
                            {hasCustomerDraft && renderCustomerCard(false)}
                            {hasItemDraft && renderItemCard(false)}
                          </View>
                        ) : (
                          <>
                            {hasInvoiceDraft && renderDraftCard(true)}
                            {hasRentalDraft && renderRentalDraftCard(true)}
                            {hasCustomerDraft && renderCustomerCard(true)}
                            {hasItemDraft && renderItemCard(true)}
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}

                {/* Passive status indicator at the bottom of message history when recording */}
                {isRecording && (
                  <View style={styles.msgRowAssistantContainer}>
                    <View style={styles.assistantAvatar}>
                      <Ionicons name="sparkles" size={15} color="#f97316" />
                    </View>
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
                  <View style={styles.msgRowAssistantContainer}>
                    <View style={styles.assistantAvatar}>
                      <Ionicons name="sparkles" size={15} color="#f97316" />
                    </View>
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
                  <View style={styles.msgRowAssistantContainer}>
                    <View style={styles.assistantAvatar}>
                      <Ionicons name="sparkles" size={15} color="#f97316" />
                    </View>
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
                  <View style={styles.msgRowAssistantContainer}>
                    <View style={styles.assistantAvatar}>
                      <Ionicons name="sparkles" size={15} color="#f97316" />
                    </View>
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
  msgRowUserContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  msgRowAssistantContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  assistantAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
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
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
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
