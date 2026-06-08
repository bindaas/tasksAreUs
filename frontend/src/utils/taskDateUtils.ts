import type { Task } from '../api/tasks';

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

export function getDropDate(columnKey: ColumnKey): string | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (columnKey === 'overdue') return null;
  if (columnKey === 'nodate') return null;
  if (columnKey === 'today') return dateOnly(now);
  if (columnKey === 'tomorrow') {
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    return dateOnly(tom);
  }
  if (columnKey === 'day_after_tomorrow') {
    const dat = new Date(now);
    dat.setDate(dat.getDate() + 2);
    return dateOnly(dat);
  }
  const week = new Date(now);
  week.setDate(week.getDate() + 7);
  return dateOnly(week);
}

