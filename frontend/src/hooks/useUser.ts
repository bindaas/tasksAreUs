import { useAuth } from './useAuth';

// Thin compatibility shim — remove in Phase 3
export function useUser() {
  const { loading } = useAuth();
  return { loading, error: null as string | null };
}
