import { z } from 'zod';
import { isValidIsoDate, isValidTime } from './dates';

export const CATEGORIES = ['work', 'personal', 'urgent'] as const;
export type Category = (typeof CATEGORIES)[number];

/** One colour per category, used by tags, calendar chips and exports. */
export const CATEGORY_META: Record<Category, { label: string; color: string; tag: string }> = {
  work: { label: 'Work', color: '#1677ff', tag: 'blue' },
  personal: { label: 'Personal', color: '#52c41a', tag: 'green' },
  urgent: { label: 'Urgent', color: '#ff4d4f', tag: 'red' },
};

export interface Todo {
  id: string;
  title: string;
  description?: string;
  category: Category;
  /** Calendar date only, `YYYY-MM-DD`, so it never shifts with time zones. */
  dueDate?: string;
  /** Optional time of day, `HH:mm` (24h). Used to order tasks within a day. */
  dueTime?: string;
  completed: boolean;
  completedAt?: string;
  /** Manual sort key (fractional, see ordering.ts). */
  order: number;
  createdAt: string;
  updatedAt: string;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Shape accepted from the form and from imported rows. */
const todoInputObject = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
  description: optionalText(2000),
  category: z.enum(CATEGORIES, { error: 'Category must be Work, Personal or Urgent' }),
  dueDate: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || isValidIsoDate(v), 'Invalid date'),
  dueTime: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || isValidTime(v), 'Invalid time'),
  completed: z.boolean().optional().default(false),
});

export type TodoInput = z.input<typeof todoInputObject>;
export type ValidTodoInput = z.output<typeof todoInputObject>;

/**
 * Rule: a time only exists on a date. Without a due date any time (even an
 * invalid one) is dropped before validation, so it is ignored, not an error.
 */
export const todoInputSchema = z.preprocess((raw) => {
  if (raw && typeof raw === 'object' && !(raw as TodoInput).dueDate) return { ...raw, dueTime: undefined };
  return raw;
}, todoInputObject);

export function categoryLabel(c: Category): string {
  return CATEGORY_META[c].label;
}

/** Case-insensitive match of a label or key to a category. */
export function parseCategory(value: unknown): Category | undefined {
  const v = String(value ?? '').trim().toLowerCase();
  return CATEGORIES.find((c) => c === v || CATEGORY_META[c].label.toLowerCase() === v);
}
