import type { Task } from '../types';

export type ColumnKey = 'overdue' | 'today' | 'tomorrow' | 'day_after_tomorrow' | 'upcoming' | 'nodate';

export function dateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const currentYear = new Date().getFullYear();
  if (d.getFullYear() === currentYear) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + 'T00:00:00') < today;
}

export function getEffectiveDate(task: Pick<Task, 'must_do_by' | 'target_date'>): string | null {
  if (task.must_do_by && task.target_date) {
    return task.must_do_by < task.target_date ? task.must_do_by : task.target_date;
  }
  return task.must_do_by ?? task.target_date ?? null;
}

export function getDropDate(key: ColumnKey, today: Date = new Date()): string | null {
  const d = new Date(today);
  switch (key) {
    case 'today': return dateOnly(d);
    case 'tomorrow': d.setDate(d.getDate() + 1); return dateOnly(d);
    case 'day_after_tomorrow': d.setDate(d.getDate() + 2); return dateOnly(d);
    case 'upcoming': d.setDate(d.getDate() + 7); return dateOnly(d);
    case 'nodate': return null;
    default: return null;
  }
}

export function getColumn(
  task: Pick<Task, 'must_do_by' | 'target_date'>,
  today: string,
  tomorrow: string
): ColumnKey {
  const effective = getEffectiveDate(task);
  if (!effective) return 'nodate';
  if (effective < today) return 'overdue';
  if (effective === today) return 'today';
  if (effective === tomorrow) return 'tomorrow';
  const dat = new Date(tomorrow + 'T00:00:00');
  dat.setDate(dat.getDate() + 1);
  if (effective === dateOnly(dat)) return 'day_after_tomorrow';
  return 'upcoming';
}
