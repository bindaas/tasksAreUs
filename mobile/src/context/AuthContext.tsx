import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  type User,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailLink,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase';

const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn';

// Module-level flag replaces sessionStorage — resets when app is force-quit (correct behaviour)
let deliberateSignOut = false;

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  pendingEmailConfirmation: boolean;
  confirmEmailSignIn: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState(false);
  const pendingEmailLink = useRef('');

  // Google OAuth via expo-auth-session — works in Expo Go and standalone builds
  const [, googleResponse, promptGoogleSignIn] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  // Complete Google sign-in when the OAuth response arrives
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token } = googleResponse.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch(console.error);
    }
  }, [googleResponse]);

  useEffect(() => {
    // Handle magic-link deep link on initial open
    Linking.getInitialURL().then((url) => {
      if (url && isSignInWithEmailLink(auth, url)) {
        handleMagicLinkUrl(url);
      }
    });

    // Handle magic-link deep link while app is open
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (isSignInWithEmailLink(auth, url)) {
        handleMagicLinkUrl(url);
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser === null) {
        if (deliberateSignOut) {
          deliberateSignOut = false;
          setUser(null);
          setLoading(false);
        } else {
          try {
            await signInAnonymously(auth);
          } catch (err) {
            console.error('Anonymous sign-in failed:', err);
            setLoading(false);
          }
        }
      } else {
        setUser(firebaseUser);
        setLoading(false);
      }
    });

    return () => {
      sub.remove();
      unsubscribeAuth();
    };
  }, []);

  async function handleMagicLinkUrl(url: string) {
    const email = await AsyncStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
    if (email) {
      await signInWithEmailLink(auth, email, url);
      await AsyncStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
    } else {
      // Different device — ask user for their email
      pendingEmailLink.current = url;
      setPendingEmailConfirmation(true);
      setLoading(false);
    }
  }

  async function confirmEmailSignIn(email: string) {
    await signInWithEmailLink(auth, email, pendingEmailLink.current);
    await AsyncStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
    pendingEmailLink.current = '';
    setPendingEmailConfirmation(false);
  }

  async function signInWithGoogle() {
    await promptGoogleSignIn();
  }

  async function sendMagicLink(email: string) {
    // In Expo Go: link opens in browser and redirects to exp://... (no deep link back)
    // In standalone build: link redirects to tasksareus:// and AuthContext handles it above
    await sendSignInLinkToEmail(auth, email, {
      url: Linking.createURL('/'),
      handleCodeInApp: true,
      iOS: { bundleId: 'com.bindaas.tasksareus' },
      android: { packageName: 'com.bindaas.tasksareus', installApp: true },
    });
    await AsyncStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
  }

  async function signOut() {
    deliberateSignOut = true;
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        pendingEmailConfirmation,
        confirmEmailSignIn,
        signInWithGoogle,
        sendMagicLink,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
