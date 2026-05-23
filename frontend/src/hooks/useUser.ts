import { useState, useEffect } from 'react';
import { registerUser } from '../api/users';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        let deviceUuid = localStorage.getItem('device_uuid');
        let storedUserId = localStorage.getItem('user_id');

        if (!deviceUuid) {
          deviceUuid = generateUUID();
          localStorage.setItem('device_uuid', deviceUuid);
        }

        if (!storedUserId) {
          const user = await registerUser(deviceUuid);
          storedUserId = user.id;
          localStorage.setItem('user_id', storedUserId);
        }

        setUserId(storedUserId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize user');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  return { userId, loading, error };
}
