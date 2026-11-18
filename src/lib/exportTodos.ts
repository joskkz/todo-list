import * as XLSX from 'xlsx';
import { isValidTime, todayIso } from './dates';
import { CATEGORIES, CATEGORY_META, type Todo } from './todo';

const DATE_FORMAT = 'dd mmm yyyy';
const DATETIME_FORMAT = 'dd mmm yyyy hh:mm';
const MS_PER_DAY = 86_400_000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** `YYYY-MM-DD` → Excel serial date (time-zone safe). */
function isoToSerial(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - EXCEL_EPOCH) / MS_PER_DAY;
}

/** ISO timestamp → Excel serial date-time in the user's local time. */
function timestampToSerial(ts: string): number {
  const d = new Date(ts);
  const local = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  return (local - EXCEL_EPOCH) / MS_PER_DAY;
}

/** `HH:mm` → Excel time (fraction of a day). */
function timeToSerial(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h * 60 + m) / 1440;
}

function dateCell(serial: number, z: string): XLSX.CellObject {
  return { t: 'n', v: serial, z };
}

const TIME_FORMAT_XL = 'hh:mm';
const HEADERS = ['Title', 'Description', 'Category', 'Due Date', 'Due Time', 'Status', 'Created', 'Completed At'];

export function buildTasksWorkbook(todos: readonly Todo[], scopeLabel: string): XLSX.WorkBook {
  const rows: (string | number | XLSX.CellObject | null)[][] = [HEADERS];
  for (const t of todos) {
    rows.push([
      t.title,
      t.description ?? '',
      CATEGORY_META[t.category].label,
      t.dueDate ? dateCell(isoToSerial(t.dueDate), DATE_FORMAT) : '',
      t.dueTime && isValidTime(t.dueTime) ? dateCell(timeToSerial(t.dueTime), TIME_FORMAT_XL) : '',
      t.completed ? 'Done' : 'Open',
      dateCell(timestampToSerial(t.createdAt), DATETIME_FORMAT),
      t.completedAt ? dateCell(timestampToSerial(t.completedAt), DATETIME_FORMAT) : '',
    ]);
  }
  const tasks = XLSX.utils.aoa_to_sheet(rows);
  tasks['!cols'] = [{ wch: 40 }, { wch: 50 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 18 }];
  tasks['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length - 1, 1), c: HEADERS.length - 1 } }) };

  const today = todayIso();
  const open = todos.filter((t) => !t.completed);
  const summaryRows: (string | number)[][] = [
    ['To-Do report'],
    ['Exported', today],
    ['Scope', scopeLabel],
    [],
    ['', 'Total', 'Open', 'Completed', 'Overdue'],
    [
      'All categories',
      todos.length,
      open.length,
      todos.length - open.length,
      open.filter((t) => t.dueDate && t.dueDate < today).length,
    ],
    ...CATEGORIES.map((c) => {
      const inCat = todos.filter((t) => t.category === c);
      const openInCat = inCat.filter((t) => !t.completed);
      return [
        CATEGORY_META[c].label,
        inCat.length,
        openInCat.length,
        inCat.length - openInCat.length,
        openInCat.filter((t) => t.dueDate && t.dueDate < today).length,
      ];
    }),
  ];
  const summary = XLSX.utils.aoa_to_sheet(summaryRows);
  summary['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, tasks, 'Tasks');
  XLSX.utils.book_append_sheet(wb, summary, 'Summary');
  return wb;
}

export function exportFileName(): string {
  return `todos-${todayIso()}.xlsx`;
}

/** Triggers a browser download of the tasks as .xlsx. */
export function downloadTasks(todos: readonly Todo[], scopeLabel: string): string {
  const name = exportFileName();
  XLSX.writeFile(buildTasksWorkbook(todos, scopeLabel), name, { compression: true });
  return name;
}

/** A ready-to-fill import template with the expected columns and two examples. */
export function downloadImportTemplate(): void {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Title', 'Description', 'Category', 'Due Date', 'Due Time', 'Completed'],
    ['Prepare Q4 sales report', 'Pull numbers from the CRM', 'Work', dateCell(isoToSerial(todayIso()), 'yyyy-mm-dd'), dateCell(timeToSerial('14:30'), TIME_FORMAT_XL), 'No'],
    ['Renew car insurance', '', 'Personal', '', '', 'No'],
  ]);
  sheet['!cols'] = [{ wch: 36 }, { wch: 36 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Tasks');
  XLSX.writeFile(wb, 'todo-import-template.xlsx');
}
