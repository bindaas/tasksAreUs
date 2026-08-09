import { groupTasksForList } from '../utils/taskGrouping';
import type { PriorityTier, Task } from '../types';

const REF_DATE = new Date('2026-06-07T12:00:00');

function makeTask(overrides: Partial<Pick<Task, 'id' | 'target_date' | 'must_do_by' | 'priority' | 'sort_order' | 'updated_at'>> = {}): Task {
  return {
    id: 'task-' + Math.random(),
    board_id: 'board-1',
    title: 'Test task',
    notes: null,
    state: 'pending',
    must_do_by: null,
    target_date: null,
    completed_at: null,
    labels: [],
    priority: 'normal',
    is_high_priority: false,
    is_deleted: false,
    links: [],
    sort_order: 0,
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

  it('uses earliest of must_do_by and target_date when both are set', () => {
    // must_do_by is tomorrow, target_date is far future — must bucket as tomorrow
    const task = makeTask({ must_do_by: '2026-06-08', target_date: '2026-07-15' });
    const [section] = groupTasksForList([task], REF_DATE);
    expect(section.key).toBe('tomorrow');
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

  it('orders today section by sort_order ascending within the same priority', () => {
    const first = makeTask({ target_date: '2026-06-07', sort_order: 1 });
    const second = makeTask({ target_date: '2026-06-07', sort_order: 2 });
    const third = makeTask({ target_date: '2026-06-07', sort_order: 3 });
    const [section] = groupTasksForList([third, first, second], REF_DATE);
    expect(section.data).toEqual([first, second, third]);
  });

  it('orders today section by priority tier before sort_order', () => {
    const normalFirst = makeTask({ target_date: '2026-06-07', sort_order: 1, priority: 'normal' });
    const highSecond = makeTask({ target_date: '2026-06-07', sort_order: 2, priority: 'high' });
    const [section] = groupTasksForList([normalFirst, highSecond], REF_DATE);
    expect(section.data).toEqual([highSecond, normalFirst]);
  });

  it('ranks today section high < medium < normal, then by sort_order within a tier', () => {
    const normal = makeTask({ id: 'n', target_date: '2026-06-07', sort_order: 1, priority: 'normal' });
    const medium = makeTask({ id: 'm', target_date: '2026-06-07', sort_order: 2, priority: 'medium' });
    const high = makeTask({ id: 'h', target_date: '2026-06-07', sort_order: 3, priority: 'high' });
    const [section] = groupTasksForList([normal, medium, high], REF_DATE);
    expect(section.data).toEqual([high, medium, normal]);
  });

  it('orders upcoming section by target_date ascending, nulls last', () => {
    const later = makeTask({ target_date: '2026-08-01' });
    const earlier = makeTask({ target_date: '2026-07-01' });
    const [section] = groupTasksForList([later, earlier], REF_DATE);
    expect(section.key).toBe('upcoming');
    expect(section.data).toEqual([earlier, later]);
  });

  it('overdue section still orders by updated_at descending, unaffected by sort_order', () => {
    const older = makeTask({ target_date: '2026-01-01', sort_order: 99, updated_at: '2026-01-01T00:00:00' });
    const newer = makeTask({ target_date: '2026-01-02', sort_order: 1, updated_at: '2026-01-05T00:00:00' });
    const [section] = groupTasksForList([older, newer], REF_DATE);
    expect(section.key).toBe('overdue');
    expect(section.data).toEqual([newer, older]);
  });

  it('overdue section still puts high above non-high, tiebroken by updated_at (not the 3-way tier rank)', () => {
    const high = makeTask({
      id: 'h', target_date: '2026-01-01', priority: 'high', updated_at: '2026-01-01T00:00:00',
    });
    const normal = makeTask({
      id: 'n', target_date: '2026-01-01', priority: 'normal', updated_at: '2026-01-05T00:00:00',
    });
    const [section] = groupTasksForList([normal, high], REF_DATE);
    expect(section.key).toBe('overdue');
    expect(section.data).toEqual([high, normal]);
  });

  it('overdue section does not distinguish medium from normal — both tiebreak by updated_at only', () => {
    const medium = makeTask({
      id: 'm', target_date: '2026-01-01', priority: 'medium' as PriorityTier, updated_at: '2026-01-01T00:00:00',
    });
    const normal = makeTask({
      id: 'n', target_date: '2026-01-01', priority: 'normal', updated_at: '2026-01-05T00:00:00',
    });
    const [section] = groupTasksForList([medium, normal], REF_DATE);
    expect(section.key).toBe('overdue');
    // Newer updated_at wins regardless of medium vs normal — no tier rank applied here.
    expect(section.data).toEqual([normal, medium]);
  });
});
