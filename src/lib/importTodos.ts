import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import * as XLSX from 'xlsx';
import { ISO_DATE, TIME_FORMAT, isValidIsoDate } from './dates';
import { CATEGORY_META, parseCategory, todoInputSchema, type TodoInput } from './todo';

dayjs.extend(customParseFormat);

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const IMPORT_ACCEPT = '.csv,.xlsx,.xls';

type Field = 'title' | 'description' | 'category' | 'dueDate' | 'dueTime' | 'completed';

/** Header names we recognise, compared lower-case with spaces/punctuation removed. */
const HEADER_ALIASES: Record<Field, string[]> = {
  title: ['title', 'task', 'taskname', 'name', 'todo', 'item'],
  description: ['description', 'desc', 'details', 'notes', 'note'],
  category: ['category', 'type', 'list', 'tag'],
  dueDate: ['duedate', 'due', 'date', 'deadline'],
  dueTime: ['duetime', 'time', 'starttime', 'at'],
  completed: ['completed', 'done', 'status', 'complete', 'iscompleted'],
};

/**
 * Text date formats accepted, tried in order. Day-first is preferred over month-first.
 * dayjs strict parsing treats `D` and `DD` as different widths ("05" fails `D`),
 * so every day/month field is listed both with and without a leading zero.
 */
const DAY_MONTH = ['D/M', 'DD/MM', 'D/MM', 'DD/M'];
const DATE_FORMATS = [
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  ...['/', '-', '.'].flatMap((sep) => DAY_MONTH.map((dm) => `${dm.replace('/', sep)}${sep}YYYY`)),
  'D MMM YYYY',
  'DD MMM YYYY',
  'D MMMM YYYY',
  'DD MMMM YYYY',
  'MMM D, YYYY',
  'MMM DD, YYYY',
  'MMMM D, YYYY',
  'MMMM DD, YYYY',
];

/** Text time formats accepted (24-hour and 12-hour), tried in order. */
const TIME_FORMATS = ['HH:mm', 'H:mm', 'HH:mm:ss', 'H:mm:ss', 'h:mm A', 'h:mmA', 'hh:mm A', 'hh:mmA', 'h A', 'hA'];

const TRUE_WORDS = ['true', 'yes', 'y', '1', 'x', 'done', 'completed', 'complete'];
const FALSE_WORDS = ['', 'false', 'no', 'n', '0', 'open', 'active', 'incomplete', 'pending', 'todo', 'to do'];

export type RowStatus = 'valid' | 'invalid' | 'duplicate';

export interface ImportRow {
  /** Spreadsheet row number (header is row 1). */
  rowNumber: number;
  status: RowStatus;
  errors: string[];
  /** Values as shown in the preview. */
  display: { title: string; category: string; dueDate: string; dueTime: string; completed: string };
  input?: TodoInput;
}

export interface ImportResult {
  rows: ImportRow[];
  sheetName: string;
  /** A problem with the whole file (e.g. no Title column). */
  fileError?: string;
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapHeaders(headers: string[]): Partial<Record<Field, string>> {
  const map: Partial<Record<Field, string>> = {};
  for (const header of headers) {
    const key = normaliseHeader(header);
    for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
      if (!map[field] && HEADER_ALIASES[field].includes(key)) map[field] = header;
    }
  }
  return map;
}

/** Excel serial numbers, Date objects and common text formats → `YYYY-MM-DD`. */
export function normaliseDate(value: unknown): { value?: string; error?: string } {
  if (value === null || value === undefined || value === '') return {};
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed || !parsed.y) return { error: 'Invalid date' };
    const iso = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    return isValidIsoDate(iso) ? { value: iso } : { error: 'Invalid date' };
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? { error: 'Invalid date' } : { value: dayjs(value).format(ISO_DATE) };
  }
  const text = String(value).trim();
  if (!text) return {};
  for (const format of DATE_FORMATS) {
    const d = dayjs(text, format, true);
    if (d.isValid()) return { value: d.format(ISO_DATE) };
  }
  return { error: `Invalid date "${text}" — use YYYY-MM-DD or DD/MM/YYYY` };
}

/**
 * Excel time cells (fraction of a day, or a date-time serial whose time part is
 * used), Date objects and text like "14:30" or "2:30 PM" → `HH:mm`.
 */
export function normaliseTime(value: unknown): { value?: string; error?: string } {
  if (value === null || value === undefined || value === '') return {};
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return { error: 'Invalid time' };
    const minutes = Math.round((value - Math.floor(value)) * 1440) % 1440;
    return { value: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}` };
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? { error: 'Invalid time' } : { value: dayjs(value).format(TIME_FORMAT) };
  }
  const text = String(value).trim().toUpperCase();
  if (!text) return {};
  for (const format of TIME_FORMATS) {
    const d = dayjs(text, format, true);
    if (d.isValid()) return { value: d.format(TIME_FORMAT) };
  }
  return { error: `Invalid time "${String(value).trim()}" — use HH:mm, e.g. 14:30` };
}

export function normaliseCompleted(value: unknown): { value?: boolean; error?: string } {
  if (typeof value === 'boolean') return { value };
  const text = String(value ?? '').trim().toLowerCase();
  if (TRUE_WORDS.includes(text)) return { value: true };
  if (FALSE_WORDS.includes(text)) return { value: false };
  return { error: `Unknown status "${value}" — use Done or Open` };
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return dayjs(value).format(ISO_DATE);
  return String(value).trim();
}

/**
 * Parses the first sheet of a CSV/XLSX/XLS file and validates every row.
 * `existingKeys` holds duplicate keys of tasks already stored.
 */
export function parseImportFile(
  data: ArrayBuffer,
  fileName: string,
  existingKeys: ReadonlySet<string>,
  keyOf: (t: { title: string; dueDate?: string }) => string,
): ImportResult {
  const isCsv = fileName.toLowerCase().endsWith('.csv');
  let workbook: XLSX.WorkBook;
  try {
    // For CSV keep cells as text so we parse dates ourselves (no US-format guessing).
    workbook = XLSX.read(data, { type: 'array', raw: isCsv, dense: true });
  } catch {
    return { rows: [], sheetName: '', fileError: 'This file could not be read. Is it a valid CSV or Excel file?' };
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) return { rows: [], sheetName: '', fileError: 'The file has no sheets.' };

  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true, blankrows: false });
  if (records.length === 0) return { rows: [], sheetName, fileError: 'The sheet is empty.' };
  if (records.length > MAX_IMPORT_ROWS) {
    return { rows: [], sheetName, fileError: `Too many rows (${records.length}). The limit is ${MAX_IMPORT_ROWS}.` };
  }

  const headers = (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false })[0] ?? []).map(String);
  const columns = mapHeaders(headers);
  if (!columns.title) {
    return { rows: [], sheetName, fileError: 'Could not find a "Title" column. Download the template to see the expected format.' };
  }

  const seen = new Set(existingKeys);
  const rows = records.map((record, i): ImportRow => {
    const get = (field: Field) => (columns[field] ? record[columns[field]] : '');
    const errors: string[] = [];

    const title = cellText(get('title'));
    const categoryRaw = cellText(get('category'));
    const category = parseCategory(categoryRaw);
    const due = normaliseDate(get('dueDate'));
    const time = normaliseTime(get('dueTime'));
    const completed = normaliseCompleted(get('completed'));

    if (!categoryRaw) errors.push('Category is required');
    else if (!category) errors.push(`Unknown category "${categoryRaw}" — use Work, Personal or Urgent`);
    if (due.error) errors.push(due.error);
    if (time.error) errors.push(time.error);
    else if (time.value && !due.value && !due.error) errors.push('A time needs a due date');
    if (completed.error) errors.push(completed.error);

    const input: TodoInput = {
      title,
      description: cellText(get('description')),
      category: category ?? ('' as never),
      dueDate: due.value,
      dueTime: time.value,
      completed: completed.value ?? false,
    };
    const check = todoInputSchema.safeParse(input);
    if (!check.success) {
      for (const issue of check.error.issues) {
        // Category and date problems already have a friendlier message above.
        if (issue.path[0] === 'category' || issue.path[0] === 'dueDate' || issue.path[0] === 'dueTime') continue;
        errors.push(issue.message);
      }
    }

    const display = {
      title,
      category: category ? CATEGORY_META[category].label : categoryRaw,
      dueDate: due.value ?? cellText(get('dueDate')),
      dueTime: time.value ?? cellText(get('dueTime')),
      completed: completed.value ? 'Done' : 'Open',
    };
    const rowNumber = i + 2;
    if (errors.length) return { rowNumber, status: 'invalid', errors, display };

    const key = keyOf({ title, dueDate: due.value });
    if (seen.has(key)) {
      return { rowNumber, status: 'duplicate', errors: ['Already exists (same title and due date)'], display, input };
    }
    seen.add(key);
    return { rowNumber, status: 'valid', errors: [], display, input };
  });

  return { rows, sheetName };
}
