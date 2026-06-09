import { useState, useRef } from 'react';
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
import type { Message } from '../types';

interface DisplayMessage extends Message {
  pending?: boolean;
}

export function ChatScreen() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId;
    const conv = await createConversation();
    setConversationId(conv.id);
    return conv.id;
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setInput('');
    setError(null);
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: 'user',
        content: trimmed,
        suggested_questions: null,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const convId = await ensureConversation();
      const response = await sendMessage(convId, trimmed);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        {
          id: `user-${response.message.id}`,
          role: 'user' as const,
          content: trimmed,
          suggested_questions: null,
          created_at: response.message.created_at,
        },
        response.message,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
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
            <View className="items-center justify-center pt-24">
              <Text className="text-4xl mb-3">💬</Text>
              <Text className="text-gray-400 text-base text-center">
                Ask me about your tasks
              </Text>
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
                    {msg.suggested_questions.map((q, i) => (
                      <TouchableOpacity
                        key={i}
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
