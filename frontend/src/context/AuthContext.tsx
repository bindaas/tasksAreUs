import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  type User,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInAnonymously,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
} from '@firebase/auth';
import { auth } from '../firebase';

const SIGNED_OUT_KEY = 'auth_signed_out';
const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  // truthy when a magic-link callback landed but email is unknown (different device)
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
  const signingOut = useRef(false);
  const pendingEmailLink = useRef('');

  useEffect(() => {
    // Handle magic-link callback when the user lands on the app via email link
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const email = localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
      if (email) {
        // Same device — complete sign-in immediately
        signInWithEmailLink(auth, email, window.location.href)
          .then(() => {
            localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
            sessionStorage.removeItem(SIGNED_OUT_KEY);
            window.history.replaceState(null, '', window.location.pathname);
          })
          .catch(console.error);
      } else {
        // Different device — store the link and ask the user for their email via UI
        pendingEmailLink.current = window.location.href;
        window.history.replaceState(null, '', window.location.pathname);
        setPendingEmailConfirmation(true);
        setLoading(false);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser === null) {
        if (signingOut.current || sessionStorage.getItem(SIGNED_OUT_KEY)) {
          // Deliberate sign-out — show LoginPage instead of auto-signing in
          signingOut.current = false;
          setUser(null);
          setLoading(false);
        } else {
          // First load with no session — sign in anonymously (zero friction)
          try {
            await signInAnonymously(auth);
            // onAuthStateChanged fires again with the anonymous user
          } catch (err) {
            console.error('Anonymous sign-in failed:', err);
            setLoading(false);
          }
        }
      } else {
        sessionStorage.removeItem(SIGNED_OUT_KEY);
        setUser(firebaseUser);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function confirmEmailSignIn(email: string) {
    await signInWithEmailLink(auth, email, pendingEmailLink.current);
    localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
    sessionStorage.removeItem(SIGNED_OUT_KEY);
    pendingEmailLink.current = '';
    setPendingEmailConfirmation(false);
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    // signInWithPopup creates a new Google session; does not link to the current
    // anonymous session. Anonymous data is reconnected via manual SQL migration.
    await signInWithPopup(auth, provider);
  }

  async function sendMagicLink(email: string) {
    await sendSignInLinkToEmail(auth, email, {
      url: window.location.origin,
      handleCodeInApp: true,
    });
    localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
  }

  async function signOut() {
    signingOut.current = true;
    sessionStorage.setItem(SIGNED_OUT_KEY, '1');
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{
      user, loading, pendingEmailConfirmation,
      confirmEmailSignIn, signInWithGoogle, sendMagicLink, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
