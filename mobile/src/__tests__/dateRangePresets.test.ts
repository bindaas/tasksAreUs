import { getPresetRange } from '../utils/dateRangePresets';

describe('getPresetRange', () => {
  const REFERENCE = new Date(2026, 5, 15); // June 15, 2026 (month is 0-indexed)

  it('this_month runs from the 1st of the current month through the reference date', () => {
    expect(getPresetRange('this_month', REFERENCE)).toEqual({
      from: '2026-06-01',
      to: '2026-06-15',
    });
  });

  it('last_month covers the full previous month', () => {
    expect(getPresetRange('last_month', REFERENCE)).toEqual({
      from: '2026-05-01',
      to: '2026-05-31',
    });
  });

  it('last_three_months is a rolling window from 2 months back through the reference date', () => {
    expect(getPresetRange('last_three_months', REFERENCE)).toEqual({
      from: '2026-04-01',
      to: '2026-06-15',
    });
  });

  it('last_month crosses a year boundary in January', () => {
    const january = new Date(2026, 0, 10);
    expect(getPresetRange('last_month', january)).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('last_three_months crosses a year boundary in January', () => {
    const january = new Date(2026, 0, 10);
    expect(getPresetRange('last_three_months', january)).toEqual({
      from: '2025-11-01',
      to: '2026-01-10',
    });
  });

  it('last_three_months crosses a year boundary in February', () => {
    const february = new Date(2026, 1, 5);
    expect(getPresetRange('last_three_months', february)).toEqual({
      from: '2025-12-01',
      to: '2026-02-05',
    });
  });
});
