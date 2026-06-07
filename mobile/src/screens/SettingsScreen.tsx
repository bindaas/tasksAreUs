import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const isAnonymous = user?.isAnonymous ?? true;

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-6">
        <Text className="text-2xl font-bold text-gray-900 mb-6">Settings</Text>

        <View className="bg-gray-50 rounded-xl p-4 mb-4">
          <Text className="text-xs text-gray-400 uppercase font-semibold mb-1">Account</Text>
          <Text className="text-gray-700">
            {isAnonymous ? 'Anonymous user' : (user?.displayName ?? user?.email ?? user?.uid)}
          </Text>
        </View>

        <Text className="text-gray-400 text-center text-sm mb-6">
          Full settings coming in PR 5
        </Text>

        <TouchableOpacity
          onPress={handleSignOut}
          className="w-full border border-red-300 rounded-xl py-4 items-center"
        >
          <Text className="text-red-500 font-semibold">Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
