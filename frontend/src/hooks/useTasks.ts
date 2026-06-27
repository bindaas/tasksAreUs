import { useState, useEffect, useCallback } from 'react';
import { listTasks, type Task } from '../api/tasks';
import { useBoard } from '../context/BoardContext';

export function useTasks(state?: 'pending' | 'done') {
  const { activeBoard } = useBoard();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!activeBoard) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listTasks(state, activeBoard.id);
      setTasks(result.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [state, activeBoard?.id]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, error, refetch: fetchTasks };
}
