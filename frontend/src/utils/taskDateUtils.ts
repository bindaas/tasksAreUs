import type { Task } from '../api/tasks';

export type ColumnKey = 'overdue' | 'today' | 'tomorrow' | 'day_after_tomorrow' | 'monday' | 'upcoming' | 'nodate';

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

export function formatDateWithDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.toLocaleDateString(undefined, { month: 'long' });
  const day = d.getDate();
  const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
  return `${month} ${day}, ${dayName}`;
}

export function isFriday(): boolean {
  return new Date().getDay() === 5;
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

// True when target_date is set and differs from must_do_by — the condition
// task cards use to decide whether a "Target" date line/link renders at all
// (must_do_by may be unset entirely, in which case target_date always qualifies).
export function shouldShowTargetDate(task: Pick<Task, 'must_do_by' | 'target_date'>): boolean {
  return Boolean(task.target_date && task.target_date !== task.must_do_by);
}

// True only when both must_do_by and target_date are set and distinct — used to
// decide whether an effective-date badge should expand into two independently
// editable date fields instead of editing a single, ambiguous effective date.
export function bothDatesSetAndDistinct(task: Pick<Task, 'must_do_by' | 'target_date'>): boolean {
  return Boolean(task.must_do_by) && shouldShowTargetDate(task);
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

  if (isFriday()) {
    const monday = new Date(dat);
    monday.setDate(monday.getDate() + 1);
    if (effective === dateOnly(monday)) return 'monday';
  }

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
  if (columnKey === 'monday') {
    const mon = new Date(now);
    mon.setDate(mon.getDate() + 3);
    return dateOnly(mon);
  }
  const week = new Date(now);
  week.setDate(week.getDate() + 7);
  return dateOnly(week);
}

