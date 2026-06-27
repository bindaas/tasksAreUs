import { useState, useEffect } from 'react';
import { listLabels } from '../api/labels';
import type { Label } from '../api/tasks';
import { useBoard } from '../context/BoardContext';

export function useLabels() {
  const { activeBoard } = useBoard();
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeBoard) return;

    let cancelled = false;
    async function fetchLabels() {
      setLoading(true);
      setError(null);
      try {
        const result = await listLabels(undefined, activeBoard!.id);
        if (!cancelled) setLabels(result.labels);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load labels');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLabels();
    return () => { cancelled = true; };
  }, [activeBoard?.id]);

  const labelsByCategory = labels.reduce<Record<string, Label[]>>((acc, label) => {
    if (!acc[label.category]) {
      acc[label.category] = [];
    }
    acc[label.category].push(label);
    return acc;
  }, {});

  return { labels, labelsByCategory, loading, error };
}
