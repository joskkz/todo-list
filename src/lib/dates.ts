import dayjs from 'dayjs';

export const ISO_DATE = 'YYYY-MM-DD';
/** A task is "due soon" when it is due today or within this many days. */
export const DUE_SOON_DAYS = 2;

export const TIME_FORMAT = 'HH:mm';

/** `HH:mm`, 24-hour. */
export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * Same-day ordering: tasks without a time first, then by time.
 * Returns 0 when both have the same time (or none), so callers can tie-break.
 */
export function compareTime(a?: string, b?: string): number {
  if (!a !== !b) return a ? 1 : -1;
  return (a ?? '').localeCompare(b ?? '');
}

export function todayIso(): string {
  return dayjs().format(ISO_DATE);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function addDaysIso(iso: string, days: number): string {
  return dayjs(iso).add(days, 'day').format(ISO_DATE);
}

export type DueState = 'none' | 'overdue' | 'soon' | 'later';

/** Completed tasks are never flagged as overdue or due soon. */
export function dueState(dueDate: string | undefined, completed: boolean, today = todayIso()): DueState {
  if (!dueDate || completed) return 'none';
  if (dueDate < today) return 'overdue';
  if (dueDate <= addDaysIso(today, DUE_SOON_DAYS)) return 'soon';
  return 'later';
}

/** "Today", "Tomorrow", "Yesterday", otherwise e.g. "20 Nov 2026". */
export function formatDue(dueDate: string | undefined, today = todayIso()): string {
  if (!dueDate) return 'No due date';
  if (dueDate === today) return 'Today';
  if (dueDate === addDaysIso(today, 1)) return 'Tomorrow';
  if (dueDate === addDaysIso(today, -1)) return 'Yesterday';
  return dayjs(dueDate).format('D MMM YYYY');
}
