import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '@/lib/theme';
import { useNetwork } from '@/contexts/NetworkContext';
import { listConversations, listMessages, sendMessage } from '@/services/aiChat';
import type { AIConversation, AIMessage } from '@/lib/types';

interface ChatItem {
  id: string;
  role: 'doctor' | 'assistant';
  content: string;
  source_record_ids: string[];
  created_at: string;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default function PatientAssistant() {
  const { id: patientId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isOnline } = useNetwork();
  const flatListRef = useRef<FlatList>(null);

  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    loadConversations();
  }, [patientId]);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId]);

  const loadConversations = useCallback(async () => {
    try {
      setInitialLoading(true);
      const convs = await listConversations(patientId!);
      setConversations(convs);
      if (convs.length > 0) {
        setActiveConversationId(convs[0].id);
      }
    } catch (e) {
      console.warn('[assistant] load conversations warning:', e);
    } finally {
      setInitialLoading(false);
    }
  }, [patientId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const msgs = await listMessages(conversationId);
      setMessages(
        msgs.map((m: AIMessage) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          source_record_ids: m.source_record_ids ?? [],
          created_at: m.created_at,
        }))
      );
    } catch (e) {
      console.warn('[assistant] load messages warning:', e);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !isOnline) return;

    Keyboard.dismiss();
    setError(null);
    setInput('');

    const optimisticMsg: ChatItem = {
      id: `temp-${Date.now()}`,
      role: 'doctor',
      content: trimmed,
      source_record_ids: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setLoading(true);

    try {
      const response = await sendMessage(patientId!, activeConversationId, trimmed);

      if (!activeConversationId && response.conversation_id && isUuid(response.conversation_id)) {
        setActiveConversationId(response.conversation_id);
      }

      const assistantItem: ChatItem = {
        id: response.assistant_message.id,
        role: 'assistant',
        content: response.assistant_message.content,
        source_record_ids: response.assistant_message.source_record_ids ?? [],
        created_at: response.assistant_message.created_at,
      };

      setMessages((prev) => [...prev, assistantItem]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to get response');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInput(trimmed);
    } finally {
      setLoading(false);
    }
  }, [input, loading, isOnline, patientId, activeConversationId]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToEnd();
  }, [messages.length]);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  const renderMessage = useCallback(({ item }: { item: ChatItem }) => {
    const isDoctor = item.role === 'doctor';
    return (
      <View style={[styles.messageBubble, isDoctor ? styles.doctorBubble : styles.assistantBubble]}>
        <View style={styles.roleRow}>
          <Ionicons
            name={isDoctor ? 'person' : 'sparkles'}
            size={14}
            color={isDoctor ? colors.primary : colors.warning}
          />
          <Text style={styles.roleLabel}>{isDoctor ? 'You' : 'Assistant'}</Text>
        </View>
        <Text style={[styles.messageText, isDoctor && styles.doctorText]}>{item.content}</Text>
        {!isDoctor && item.source_record_ids.length > 0 && (
          <View style={styles.sourcesRow}>
            <Ionicons name="document-text-outline" size={12} color={colors.mutedForeground} />
            <Text style={styles.sourcesText}>
              Sources: {item.source_record_ids.length} record{item.source_record_ids.length > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>
    );
  }, []);

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <Text style={styles.headerSubtitle}>Patient {patientId?.substring(0, 8)}</Text>
        </View>
        <TouchableOpacity onPress={startNewConversation} style={styles.headerAction}>
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.destructive} />
          <Text style={styles.offlineText}>Offline — AI Assistant requires internet</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <TouchableOpacity activeOpacity={1} onPress={Keyboard.dismiss} style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>Ask about this patient</Text>
            <Text style={styles.emptySubtitle}>
              Questions are answered using only data from the patient's scanned records.
            </Text>
          </TouchableOpacity>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={scrollToEnd}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            onTouchStart={Keyboard.dismiss}
          />
        )}

        {error && (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading && (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.typingText}>Assistant is thinking…</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder={isOnline ? 'Ask a question…' : 'Go online to use assistant'}
            placeholderTextColor={colors.mutedForeground}
            editable={isOnline && !loading}
            multiline
            maxLength={1000}
            returnKeyType="send"
            enablesReturnKeyAutomatically
            onSubmitEditing={handleSend}
            blurOnSubmit
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || loading || !isOnline}
            style={[
              styles.sendButton,
              (!input.trim() || loading || !isOnline) && styles.sendButtonDisabled,
            ]}
          >
            <Ionicons
              name="send"
              size={20}
              color={!input.trim() || loading || !isOnline ? colors.mutedForeground : colors.primaryForeground}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBack: {
    padding: spacing.xs,
  },
  headerCenter: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  headerAction: {
    padding: spacing.xs,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.destructiveLight,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  offlineText: {
    fontSize: fontSize.sm,
    color: colors.destructive,
    fontWeight: fontWeight.medium,
  },
  chatArea: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.foreground,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  messagesList: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  doctorBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  roleLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.mutedForeground,
  },
  messageText: {
    fontSize: fontSize.md,
    color: colors.foreground,
    lineHeight: 20,
  },
  doctorText: {
    color: colors.primaryForeground,
  },
  sourcesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sourcesText: {
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  errorBar: {
    backgroundColor: colors.destructiveLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.destructive,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typingText: {
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.foreground,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.muted,
  },
});
