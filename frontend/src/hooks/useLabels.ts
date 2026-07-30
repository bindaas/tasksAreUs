import { useState, useEffect } from 'react';
import { listLabels } from '../api/labels';
import type { Label } from '../api/tasks';
import { useBoard } from '../context/BoardContext';

export function useLabels(boardIdOverride?: string) {
  const { activeBoard, loading: boardLoading, error: boardError } = useBoard();
  const usingOverride = boardIdOverride !== undefined;
  const boardId = usingOverride ? boardIdOverride : activeBoard?.id;
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usingOverride && !boardLoading && !activeBoard) {
      setLoading(false);
      setError(boardError ?? 'Could not load boards');
      return;
    }
    if (!boardId) return;

    let cancelled = false;
    async function fetchLabels() {
      setLoading(true);
      setError(null);
      try {
        const result = await listLabels(undefined, boardId!);
        if (!cancelled) setLabels(result.labels);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load labels');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLabels();
    return () => { cancelled = true; };
  }, [boardId, usingOverride, boardLoading, boardError]);

  const labelsByCategory = labels.reduce<Record<string, Label[]>>((acc, label) => {
    if (!acc[label.category]) {
      acc[label.category] = [];
    }
    acc[label.category].push(label);
    return acc;
  }, {});

  function addLabel(label: Label) {
    setLabels((prev) => [...prev, label]);
  }

  return { labels, labelsByCategory, loading, error, addLabel };
}
