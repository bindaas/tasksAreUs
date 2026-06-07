import { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { TasksScreen } from '../screens/TasksScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { LoginScreen } from '../screens/LoginScreen';

export type RootTabParamList = {
  Tasks: undefined;
  Chat: undefined;
  Reports: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function AppNavigator() {
  const { user, loading, pendingEmailConfirmation, confirmEmailSignIn } = useAuth();
  const [confirmEmail, setConfirmEmail] = useState('');
  const [confirming, setConfirming] = useState(false);

  if (loading) return null;

  // Magic link opened on a different device — ask user to confirm their email address
  if (pendingEmailConfirmation) {
    async function handleConfirm() {
      if (!confirmEmail.trim()) return;
      setConfirming(true);
      try {
        await confirmEmailSignIn(confirmEmail.trim());
      } catch (err) {
        Alert.alert('Sign-in failed', String(err));
      } finally {
        setConfirming(false);
      }
    }
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-xl font-bold text-gray-900 mb-2">Confirm your email</Text>
        <Text className="text-gray-500 text-center mb-8">
          Enter the email address you used to request the sign-in link.
        </Text>
        <TextInput
          value={confirmEmail}
          onChangeText={setConfirmEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base mb-4"
        />
        <TouchableOpacity
          onPress={handleConfirm}
          disabled={confirming || !confirmEmail.trim()}
          className="w-full bg-indigo-600 rounded-xl py-4 items-center"
        >
          {confirming ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Confirm</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // After deliberate sign-out, user is null — show LoginScreen outside the tab navigator
  if (!user) {
    return (
      <NavigationContainer>
        <LoginScreen />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#4f46e5',
          tabBarInactiveTintColor: '#9ca3af',
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Tasks"
          component={TasksScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>✓</Text> }}
        />
        <Tab.Screen
          name="Chat"
          component={ChatScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>💬</Text> }}
        />
        <Tab.Screen
          name="Reports"
          component={ReportsScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📊</Text> }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙️</Text> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
