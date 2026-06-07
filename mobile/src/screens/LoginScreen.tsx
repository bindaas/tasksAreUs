import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';

export function LoginScreen() {
  const { signInWithGoogle, sendMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      Alert.alert('Sign-in failed', String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await sendMagicLink(email.trim());
      setLinkSent(true);
    } catch (err) {
      Alert.alert('Failed to send link', String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-white items-center justify-center px-8">
      <Text className="text-3xl font-bold text-gray-900 mb-2">tasksAreUs</Text>
      <Text className="text-gray-500 mb-10">Sign in to continue</Text>

      <TouchableOpacity
        onPress={handleGoogle}
        disabled={loading}
        className="w-full bg-indigo-600 rounded-xl py-4 items-center mb-6"
      >
        <Text className="text-white font-semibold text-base">Continue with Google</Text>
      </TouchableOpacity>

      <View className="w-full">
        <Text className="text-gray-600 text-sm mb-2">Or sign in with email link</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          className="border border-gray-300 rounded-xl px-4 py-3 text-base mb-3"
        />
        {linkSent ? (
          <Text className="text-green-600 text-center text-sm">
            Check your email — tap the link to sign in.{'\n'}
            (Note: deep-link sign-in works in standalone builds only, not Expo Go)
          </Text>
        ) : (
          <TouchableOpacity
            onPress={handleMagicLink}
            disabled={loading || !email.trim()}
            className="w-full border border-indigo-600 rounded-xl py-4 items-center"
          >
            {loading ? (
              <ActivityIndicator color="#4f46e5" />
            ) : (
              <Text className="text-indigo-600 font-semibold text-base">Send magic link</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
