import type { PriorityTier, Task } from '../types';
import { type ColumnKey, dateOnly, getColumn } from './taskDateUtils';

const TIER_RANK: Record<PriorityTier, number> = { high: 0, medium: 1, normal: 2 };

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
    if (key === 'overdue') {
      // Field-name update only, per the plan: this bucket keeps its existing
      // high-vs-not-high split and updated_at tiebreak (deliberately mirroring
      // the backend's Overdue-vs-Today/Tomorrow distinction) — it does not get
      // the else branch's full 3-way tier rank.
      buckets[key].sort((a, b) => {
        const aHigh = a.priority === 'high';
        const bHigh = b.priority === 'high';
        if (aHigh !== bHigh) {
          return aHigh ? -1 : 1;
        }
        return b.updated_at.localeCompare(a.updated_at);
      });
    } else if (key === 'upcoming') {
      buckets[key].sort((a, b) => {
        if (!a.target_date && !b.target_date) return 0;
        if (!a.target_date) return 1;
        if (!b.target_date) return -1;
        return a.target_date < b.target_date ? -1 : a.target_date > b.target_date ? 1 : 0;
      });
    } else {
      buckets[key].sort((a, b) => {
        const rankDiff = TIER_RANK[a.priority] - TIER_RANK[b.priority];
        if (rankDiff !== 0) return rankDiff;
        return a.sort_order - b.sort_order;
      });
    }
  }

  return SECTION_ORDER
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, title: SECTION_TITLES[key], data: buckets[key] }));
}
