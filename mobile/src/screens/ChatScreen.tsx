import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createConversation, sendMessage } from '../api/conversations';
import { getSettings } from '../api/settings';
import { buildOptimisticMessage, confirmMessages, rollbackMessage } from '../utils/chatUtils';
import type { Message } from '../types';

export function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starterQuestions, setStarterQuestions] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  // Ref latch prevents duplicate conversations if ensureConversation is ever called concurrently
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((s) => setStarterQuestions(s.starter_questions ?? []))
      .catch(() => {});
  }, []);

  async function ensureConversation(): Promise<string> {
    if (conversationIdRef.current) return conversationIdRef.current;
    const conv = await createConversation();
    conversationIdRef.current = conv.id;
    return conv.id;
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setInput('');
    setError(null);
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, buildOptimisticMessage(trimmed, tempId)]);

    try {
      const convId = await ensureConversation();
      const response = await sendMessage(convId, trimmed);
      setMessages((prev) => confirmMessages(prev, tempId, trimmed, response.message));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages((prev) => rollbackMessage(prev, tempId));
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="px-4 pt-2 pb-4 bg-gray-50">
          <Text className="text-2xl font-bold text-gray-900">Chat</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 8 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && !sending && (
            <View className="items-center justify-center pt-24 px-4">
              <Text className="text-4xl mb-3">💬</Text>
              <Text className="text-gray-400 text-base text-center mb-4">
                {starterQuestions.length > 0
                  ? 'What would you like to know?'
                  : 'Ask me about your tasks'}
              </Text>
              {starterQuestions.length > 0 && (
                <View className="flex-row flex-wrap justify-center" style={{ gap: 8 }}>
                  {starterQuestions.map((q, idx) => (
                    <TouchableOpacity
                      key={`${idx}-${q}`}
                      onPress={() => send(q)}
                      disabled={sending}
                      className="bg-indigo-50 border border-indigo-200 rounded-full px-3 py-2"
                      style={{ opacity: sending ? 0.5 : 1 }}
                    >
                      <Text className="text-xs text-indigo-700">{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {messages.map((msg) => (
            <View
              key={msg.id}
              className={`mb-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <View
                className={`rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 rounded-br-sm'
                    : 'bg-white border border-gray-200 rounded-bl-sm shadow-sm'
                }`}
                style={{ maxWidth: '80%' }}
              >
                <Text
                  className={`text-sm ${msg.role === 'user' ? 'text-white' : 'text-gray-800'}`}
                >
                  {msg.content}
                </Text>
              </View>

              {msg.role === 'assistant' &&
                msg.suggested_questions &&
                msg.suggested_questions.length > 0 && (
                  <View className="flex-row flex-wrap mt-2" style={{ maxWidth: '85%' }}>
                    {msg.suggested_questions.map((q) => (
                      <TouchableOpacity
                        key={q}
                        onPress={() => send(q)}
                        disabled={sending}
                        className="bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1.5 mr-2 mb-2"
                        style={{ opacity: sending ? 0.5 : 1 }}
                      >
                        <Text className="text-xs text-indigo-700">{q}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
            </View>
          ))}

          {sending && (
            <View className="items-start mb-3">
              <View className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <ActivityIndicator size="small" color="#9ca3af" />
              </View>
            </View>
          )}
        </ScrollView>

        {error && (
          <View className="px-4 py-2 bg-red-50 border-t border-red-200">
            <View className="flex-row items-center justify-between">
              <Text className="text-red-700 text-sm flex-1 mr-2">{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Text className="text-red-500 text-xs underline">Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View className="border-t border-gray-200 bg-white px-4 py-3">
          <View className="flex-row items-end" style={{ gap: 8 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about your tasks…"
              placeholderTextColor="#9ca3af"
              multiline
              editable={!sending}
              className="flex-1 border border-gray-300 rounded-2xl px-4 py-2.5 text-sm text-gray-900 bg-white"
              style={{ maxHeight: 120 }}
            />
            <TouchableOpacity
              onPress={() => send(input)}
              disabled={!input.trim() || sending}
              className="w-10 h-10 bg-indigo-600 rounded-full items-center justify-center"
              style={{ opacity: !input.trim() || sending ? 0.5 : 1 }}
            >
              <Text className="text-white font-bold text-base leading-none">↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
