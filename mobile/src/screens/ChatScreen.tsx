import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ChatScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <Text className="text-2xl font-bold text-gray-900">Chat</Text>
        <Text className="text-gray-500 mt-2">Coming in PR 4</Text>
      </View>
    </SafeAreaView>
  );
}
