import { initializeApp } from 'firebase/app';
import { initializeAuth, type Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Not typed in firebase/auth web bundle; resolved at runtime by Metro via react-native condition
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: object) => Persistence;
};

const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
});

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
