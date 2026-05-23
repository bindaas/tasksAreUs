import { useState, useEffect } from 'react';
import { listLabels } from '../api/labels';
import type { Label } from '../api/tasks';

export function useLabels() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLabels() {
      setLoading(true);
      setError(null);
      try {
        const result = await listLabels();
        setLabels(result.labels);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load labels');
      } finally {
        setLoading(false);
      }
    }

    fetchLabels();
  }, []);

  const labelsByCategory = labels.reduce<Record<string, Label[]>>((acc, label) => {
    if (!acc[label.category]) {
      acc[label.category] = [];
    }
    acc[label.category].push(label);
    return acc;
  }, {});

  return { labels, labelsByCategory, loading, error };
}
