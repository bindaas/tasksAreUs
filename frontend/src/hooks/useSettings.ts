import { useState, useEffect } from 'react';
import { getSettings } from '../api/settings';

export function useSettings() {
  const [highPriorityDailyLimit, setHighPriorityDailyLimit] = useState(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then((s) => setHighPriorityDailyLimit(s.high_priority_daily_limit ?? 3))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { highPriorityDailyLimit, loading };
}
