import { dateOnly } from './taskDateUtils';

export type PresetKey = 'this_month' | 'last_month' | 'last_three_months' | 'all';

export interface DateRange {
  from: string;
  to: string;
}

export const PRESET_LABELS: Record<PresetKey, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_three_months: 'Last three months',
  all: 'All',
};

export function getPresetRange(preset: PresetKey, referenceDate: Date = new Date()): DateRange {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  switch (preset) {
    case 'this_month':
      return { from: dateOnly(new Date(year, month, 1)), to: dateOnly(referenceDate) };
    case 'last_month':
      return {
        from: dateOnly(new Date(year, month - 1, 1)),
        to: dateOnly(new Date(year, month, 0)), // day 0 = last day of previous month
      };
    case 'last_three_months':
      // Rolling window: 1st of the month two months back through today (inclusive of the
      // current partial month) — confirmed with user, not a fixed 3-month-ago-to-now range.
      return { from: dateOnly(new Date(year, month - 2, 1)), to: dateOnly(referenceDate) };
    case 'all':
      // Arbitrary anchor safely before any task this app could contain — not a real "launch date".
      return { from: dateOnly(new Date(2000, 0, 1)), to: dateOnly(referenceDate) };
  }
}
