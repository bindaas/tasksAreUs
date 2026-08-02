import type { Task } from '../types';
import { type ColumnKey, dateOnly, getColumn } from './taskDateUtils';

export interface TaskSection {
  key: ColumnKey;
  title: string;
  data: Task[];
}

const SECTION_ORDER: ColumnKey[] = [
  'overdue',
  'today',
  'tomorrow',
  'day_after_tomorrow',
  'upcoming',
  'nodate',
];

const SECTION_TITLES: Record<ColumnKey, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  day_after_tomorrow: 'Day After Tomorrow',
  upcoming: 'Upcoming',
  nodate: 'No Date',
};

export function groupTasksForList(tasks: Task[], referenceDate: Date = new Date()): TaskSection[] {
  const today = dateOnly(referenceDate);
  const tomorrowDate = new Date(referenceDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = dateOnly(tomorrowDate);

  const buckets = {} as Record<ColumnKey, Task[]>;
  for (const key of SECTION_ORDER) {
    buckets[key] = [];
  }
  for (const task of tasks) {
    buckets[getColumn(task, today, tomorrow)].push(task);
  }

  for (const key of SECTION_ORDER) {
    buckets[key].sort((a, b) => {
      if (a.is_high_priority !== b.is_high_priority) {
        return a.is_high_priority ? -1 : 1;
      }
      return b.updated_at.localeCompare(a.updated_at);
    });
  }

  return SECTION_ORDER
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, title: SECTION_TITLES[key], data: buckets[key] }));
}
