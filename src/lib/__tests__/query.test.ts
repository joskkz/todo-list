import { describe, expect, it } from 'vitest';
import { DEFAULT_QUERY, canReorder, filterAndSort, paginate, parseQuery, serializeQuery } from '../query';
import type { Todo } from '../todo';

let n = 0;
function todo(partial: Partial<Todo>): Todo {
  n += 1;
  return {
    id: `t${n}`,
    title: `Task ${n}`,
    category: 'work',
    completed: false,
    order: n,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...partial,
  };
}

const base = { q: '', status: 'all', category: 'all', sort: 'manual' } as const;

describe('filterAndSort', () => {
  it('orders tasks on the same day by time, untimed first', () => {
    const day = [
      todo({ title: 'Afternoon', dueDate: '2026-11-20', dueTime: '14:00', order: 1 }),
      todo({ title: 'Untimed', dueDate: '2026-11-20', order: 2 }),
      todo({ title: 'Morning', dueDate: '2026-11-20', dueTime: '09:00', order: 3 }),
    ];
    expect(filterAndSort(day, { ...base, sort: 'due_asc' }).map((t) => t.title)).toEqual(['Untimed', 'Morning', 'Afternoon']);
    expect(filterAndSort(day, { ...base, sort: 'due_desc' }).map((t) => t.title)).toEqual(['Untimed', 'Morning', 'Afternoon']);
  });

  const todos = [
    todo({ title: 'Prepare report', description: 'Q4 numbers', dueDate: '2026-11-20', order: 3 }),
    todo({ title: 'Buy milk', category: 'personal', completed: true, order: 1 }),
    todo({ title: 'Fix bug', category: 'urgent', dueDate: '2026-11-15', order: 2 }),
    todo({ title: 'Plan offsite', dueDate: '2026-12-01', order: 4 }),
  ];

  it('searches title and description, case-insensitively', () => {
    expect(filterAndSort(todos, { ...base, q: 'REPORT' }).map((t) => t.title)).toEqual(['Prepare report']);
    expect(filterAndSort(todos, { ...base, q: 'q4' }).map((t) => t.title)).toEqual(['Prepare report']);
  });

  it('filters by status and category', () => {
    expect(filterAndSort(todos, { ...base, status: 'completed' }).map((t) => t.title)).toEqual(['Buy milk']);
    expect(filterAndSort(todos, { ...base, status: 'active' })).toHaveLength(3);
    expect(filterAndSort(todos, { ...base, category: 'urgent' }).map((t) => t.title)).toEqual(['Fix bug']);
  });

  it('sorts by manual order', () => {
    expect(filterAndSort(todos, base).map((t) => t.title)).toEqual(['Buy milk', 'Fix bug', 'Prepare report', 'Plan offsite']);
  });

  it('sorts by due date both ways, undated tasks always last', () => {
    expect(filterAndSort(todos, { ...base, sort: 'due_asc' }).map((t) => t.title)).toEqual([
      'Fix bug',
      'Prepare report',
      'Plan offsite',
      'Buy milk',
    ]);
    expect(filterAndSort(todos, { ...base, sort: 'due_desc' }).map((t) => t.title)).toEqual([
      'Plan offsite',
      'Prepare report',
      'Fix bug',
      'Buy milk',
    ]);
  });

  it('sorts urgent first, then by due date descending in each group', () => {
    const list = [
      ...todos,
      todo({ title: 'Call client', category: 'urgent', dueDate: '2026-11-25', order: 5 }),
      todo({ title: 'Urgent undated', category: 'urgent', order: 6 }),
    ];
    expect(filterAndSort(list, { ...base, sort: 'urgent_due_desc' }).map((t) => t.title)).toEqual([
      'Call client',
      'Fix bug',
      'Urgent undated',
      'Plan offsite',
      'Prepare report',
      'Buy milk',
    ]);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 12 }, (_, i) => i + 1);

  it('slices the requested page and counts pages', () => {
    expect(paginate(items, 2, 5)).toEqual({ items: [6, 7, 8, 9, 10], total: 12, pages: 3, page: 2 });
  });

  it('clamps a page that no longer exists', () => {
    expect(paginate(items, 9, 5).page).toBe(3);
    expect(paginate(items, 9, 5).items).toEqual([11, 12]);
  });

  it('reports one page when empty', () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], total: 0, pages: 1, page: 1 });
  });
});

describe('URL query', () => {
  it('falls back to defaults for invalid values', () => {
    const q = parseQuery(new URLSearchParams('status=bogus&size=7&page=-1&sort=due_desc&category=urgent'));
    expect(q).toEqual({ ...DEFAULT_QUERY, sort: 'due_desc', category: 'urgent' });
  });

  it('only writes non-default values', () => {
    expect(serializeQuery({ ...DEFAULT_QUERY, q: 'bug', size: 20 })).toBe('q=bug&size=20');
    expect(serializeQuery(DEFAULT_QUERY)).toBe('');
  });

  it('allows drag-and-drop only in manual order without filters', () => {
    expect(canReorder(DEFAULT_QUERY)).toBe(true);
    expect(canReorder({ ...DEFAULT_QUERY, sort: 'due_asc' })).toBe(true);
    expect(canReorder({ ...DEFAULT_QUERY, q: 'x' })).toBe(false);
    expect(canReorder({ ...DEFAULT_QUERY, status: 'active' })).toBe(false);
  });
});
