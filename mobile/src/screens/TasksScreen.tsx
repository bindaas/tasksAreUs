import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function TasksScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <Text className="text-2xl font-bold text-gray-900">Tasks</Text>
        <Text className="text-gray-500 mt-2">Coming in PR 2</Text>
      </View>
    </SafeAreaView>
  );
}
