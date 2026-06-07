import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
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
  const { user, loading } = useAuth();

  if (loading) return null;

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
