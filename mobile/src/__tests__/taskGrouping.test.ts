import { groupTasksForList } from '../utils/taskGrouping';
import type { Task } from '../types';

const REF_DATE = new Date('2026-06-07T12:00:00');

function makeTask(overrides: Partial<Pick<Task, 'id' | 'target_date' | 'must_do_by'>> = {}): Task {
  return {
    id: 'task-' + Math.random(),
    title: 'Test task',
    notes: null,
    state: 'pending',
    must_do_by: null,
    target_date: null,
    completed_at: null,
    recurrence_group_id: null,
    labels: [],
    is_high_priority: false,
    is_deleted: false,
    created_at: '2026-06-01T00:00:00',
    updated_at: '2026-06-01T00:00:00',
    ...overrides,
  };
}

describe('groupTasksForList', () => {
  it('returns empty array for no tasks', () => {
    expect(groupTasksForList([], REF_DATE)).toEqual([]);
  });

  it('omits sections with no tasks', () => {
    const task = makeTask({ target_date: '2026-06-07' });
    const sections = groupTasksForList([task], REF_DATE);
    expect(sections.every((s) => s.data.length > 0)).toBe(true);
  });

  it('assigns overdue for past date', () => {
    const task = makeTask({ target_date: '2026-01-01' });
    const [section] = groupTasksForList([task], REF_DATE);
    expect(section.key).toBe('overdue');
    expect(section.data[0]).toBe(task);
  });

  it('assigns today for today date', () => {
    const task = makeTask({ target_date: '2026-06-07' });
    const [section] = groupTasksForList([task], REF_DATE);
    expect(section.key).toBe('today');
  });

  it('assigns tomorrow for tomorrow date', () => {
    const task = makeTask({ target_date: '2026-06-08' });
    const [section] = groupTasksForList([task], REF_DATE);
    expect(section.key).toBe('tomorrow');
  });

  it('assigns day_after_tomorrow correctly', () => {
    const task = makeTask({ target_date: '2026-06-09' });
    const [section] = groupTasksForList([task], REF_DATE);
    expect(section.key).toBe('day_after_tomorrow');
  });

  it('assigns upcoming for further future dates', () => {
    const task = makeTask({ target_date: '2026-07-01' });
    const [section] = groupTasksForList([task], REF_DATE);
    expect(section.key).toBe('upcoming');
  });

  it('assigns nodate when both dates are null', () => {
    const task = makeTask();
    const [section] = groupTasksForList([task], REF_DATE);
    expect(section.key).toBe('nodate');
  });

  it('orders sections: overdue before today before nodate', () => {
    const tasks = [
      makeTask({ target_date: null }),
      makeTask({ target_date: '2026-06-07' }),
      makeTask({ target_date: '2026-01-01' }),
    ];
    const keys = groupTasksForList(tasks, REF_DATE).map((s) => s.key);
    expect(keys).toEqual(['overdue', 'today', 'nodate']);
  });

  it('uses must_do_by when target_date is null', () => {
    const task = makeTask({ target_date: null, must_do_by: '2026-06-07' });
    const [section] = groupTasksForList([task], REF_DATE);
    expect(section.key).toBe('today');
  });

  it('places multiple tasks in the correct sections', () => {
    const overdue = makeTask({ target_date: '2026-01-01' });
    const today1 = makeTask({ target_date: '2026-06-07' });
    const today2 = makeTask({ target_date: '2026-06-07' });
    const sections = groupTasksForList([overdue, today1, today2], REF_DATE);
    expect(sections).toHaveLength(2);
    expect(sections[0].key).toBe('overdue');
    expect(sections[1].data).toHaveLength(2);
  });
});
