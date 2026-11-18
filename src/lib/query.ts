import { compareTime } from './dates';
import { CATEGORIES, type Category, type Todo } from './todo';

export const PAGE_SIZES = [5, 10, 15, 20] as const;
export const STATUSES = ['all', 'active', 'completed'] as const;
export const SORTS = ['manual', 'due_asc', 'due_desc', 'urgent_due_desc'] as const;

export type StatusFilter = (typeof STATUSES)[number];
export type SortKey = (typeof SORTS)[number];
export type CategoryFilter = 'all' | Category;

export interface TodoQuery {
  q: string;
  status: StatusFilter;
  category: CategoryFilter;
  sort: SortKey;
  page: number;
  size: number;
}

export const DEFAULT_QUERY: TodoQuery = {
  q: '',
  status: 'all',
  category: 'all',
  sort: 'manual',
  page: 1,
  size: 10,
};

/** Reads view state from URL params, falling back to defaults for anything invalid. */
export function parseQuery(params: { get(name: string): string | null }): TodoQuery {
  const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  return {
    q: params.get('q') ?? '',
    status: pick(params.get('status'), STATUSES, DEFAULT_QUERY.status),
    category: pick(params.get('category'), ['all', ...CATEGORIES] as const, DEFAULT_QUERY.category),
    sort: pick(params.get('sort'), SORTS, DEFAULT_QUERY.sort),
    page: Number.isInteger(page) && page > 0 ? page : DEFAULT_QUERY.page,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_QUERY.size,
  };
}

/** Only non-default values go into the URL, keeping links short. */
export function serializeQuery(query: TodoQuery): string {
  const params = new URLSearchParams();
  (Object.keys(DEFAULT_QUERY) as (keyof TodoQuery)[]).forEach((key) => {
    if (query[key] !== DEFAULT_QUERY[key]) params.set(key, String(query[key]));
  });
  return params.toString();
}

export function hasActiveFilters(query: Pick<TodoQuery, 'q' | 'status' | 'category'>): boolean {
  return query.q.trim() !== '' || query.status !== 'all' || query.category !== 'all';
}

/**
 * Drag-and-drop needs every task in view, so it is off while searching or filtering.
 * In a non-manual sort, a drop saves the visible order as the new manual order.
 */
export function canReorder(query: TodoQuery): boolean {
  return !hasActiveFilters(query);
}

/** Search → status → category → sort. Pure, so it is easy to test. */
export function filterAndSort(todos: readonly Todo[], query: Omit<TodoQuery, 'page' | 'size'>): Todo[] {
  const q = query.q.trim().toLowerCase();
  const result = todos.filter((t) => {
    if (q && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(q)) return false;
    if (query.status === 'active' && t.completed) return false;
    if (query.status === 'completed' && !t.completed) return false;
    if (query.category !== 'all' && t.category !== query.category) return false;
    return true;
  });

  return result.sort((a, b) => {
    if (query.sort === 'manual') return a.order - b.order;
    if (query.sort === 'urgent_due_desc') {
      const urgency = Number(b.category === 'urgent') - Number(a.category === 'urgent');
      if (urgency !== 0) return urgency;
    }
    // Tasks without a due date always go last (within their group), whichever direction.
    if (!a.dueDate && !b.dueDate) return a.order - b.order;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    const cmp = a.dueDate.localeCompare(b.dueDate);
    if (cmp !== 0) return query.sort === 'due_asc' ? cmp : -cmp;
    // Same day: tasks without a time first, then by time (same as the calendar).
    return compareTime(a.dueTime, b.dueTime) || a.order - b.order;
  });
}

export interface Page<T> {
  items: T[];
  total: number;
  pages: number;
  /** The requested page, clamped into range. */
  page: number;
}

export function paginate<T>(items: readonly T[], page: number, size: number): Page<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  return { items: items.slice((current - 1) * size, current * size), total, pages, page: current };
}
