import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildTasksWorkbook } from '../exportTodos';
import { normaliseCompleted, normaliseDate, normaliseTime, parseImportFile } from '../importTodos';
import type { Todo } from '../todo';
import { duplicateKey } from '../todoRepository';

function toBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function xlsxBuffer(rows: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Tasks');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('normalisers', () => {
  it('reads Excel serials and text dates', () => {
    expect(normaliseDate(46343)).toEqual({ value: '2026-11-17' });
    expect(normaliseDate('2026-11-20')).toEqual({ value: '2026-11-20' });
    expect(normaliseDate('20/11/2026')).toEqual({ value: '2026-11-20' });
    expect(normaliseDate('3 Dec 2026')).toEqual({ value: '2026-12-03' });
    // Zero-padded day/month (the template hint says DD/MM/YYYY).
    expect(normaliseDate('05/12/2026')).toEqual({ value: '2026-12-05' });
    expect(normaliseDate('5/12/2026')).toEqual({ value: '2026-12-05' });
    expect(normaliseDate('05/1/2026')).toEqual({ value: '2026-01-05' });
    expect(normaliseDate('05-01-2026')).toEqual({ value: '2026-01-05' });
    expect(normaliseDate('05.01.2026')).toEqual({ value: '2026-01-05' });
    expect(normaliseDate('03 Dec 2026')).toEqual({ value: '2026-12-03' });
    expect(normaliseDate('Dec 03, 2026')).toEqual({ value: '2026-12-03' });
    expect(normaliseDate('12/25/2026').error).toMatch(/Invalid date/);
    expect(normaliseDate('31/02/2026').error).toMatch(/Invalid date/);
    expect(normaliseDate('')).toEqual({});
    expect(normaliseDate('31/11/2026').error).toMatch(/Invalid date/);
  });

  it('reads yes/no style status values', () => {
    expect(normaliseCompleted('Yes').value).toBe(true);
    expect(normaliseCompleted('done').value).toBe(true);
    expect(normaliseCompleted('').value).toBe(false);
    expect(normaliseCompleted('Open').value).toBe(false);
    expect(normaliseCompleted('maybe').error).toBeDefined();
  });
});

describe('normaliseTime', () => {
  it('reads text, 12-hour, Excel time and date-time cells', () => {
    expect(normaliseTime('14:30').value).toBe('14:30');
    expect(normaliseTime('9:05').value).toBe('09:05');
    expect(normaliseTime('2:30 pm').value).toBe('14:30');
    expect(normaliseTime('12:00 AM').value).toBe('00:00');
    expect(normaliseTime(0.5).value).toBe('12:00');
    expect(normaliseTime(46344.75).value).toBe('18:00');
    expect(normaliseTime('').value).toBeUndefined();
    expect(normaliseTime('25:00').error).toMatch(/Invalid time/);
  });
});

describe('parseImportFile', () => {
  it('imports a time column and rejects a time without a date', () => {
    const csv = ['Title,Category,Due Date,Time', 'Standup,Work,2026-11-20,9:30', 'Lunch,Personal,,12:00', 'Bad,Work,2026-11-20,noon'].join('\n');
    const { rows } = parseImportFile(toBuffer(csv), 'tasks.csv', new Set(), duplicateKey);
    expect(rows.map((r) => r.status)).toEqual(['valid', 'invalid', 'invalid']);
    expect(rows[0].input).toMatchObject({ dueDate: '2026-11-20', dueTime: '09:30' });
    expect(rows[1].errors).toContain('A time needs a due date');
    expect(rows[2].errors[0]).toMatch(/Invalid time "noon"/);
  });

  it('validates CSV rows and reports errors with row numbers', () => {
    const csv = [
      'Task,Notes,Category,Due,Done',
      'Prepare report,Q4,work,2026-11-20,no',
      ',missing title,Work,,',
      'Hike,,Hobby,2026-11-29,',
      'Invoices,,Work,31/11/2026,',
      'Back up laptop,,PERSONAL,,yes',
    ].join('\n');
    const { rows, fileError } = parseImportFile(toBuffer(csv), 'tasks.csv', new Set(), duplicateKey);
    expect(fileError).toBeUndefined();
    expect(rows.map((r) => [r.rowNumber, r.status])).toEqual([
      [2, 'valid'],
      [3, 'invalid'],
      [4, 'invalid'],
      [5, 'invalid'],
      [6, 'valid'],
    ]);
    expect(rows[1].errors).toContain('Title is required');
    expect(rows[2].errors[0]).toMatch(/Unknown category "Hobby"/);
    expect(rows[3].errors[0]).toMatch(/Invalid date/);
    expect(rows[4].input).toMatchObject({ title: 'Back up laptop', category: 'personal', completed: true });
  });

  it('reads xlsx files with real date cells and marks duplicates', () => {
    const buf = xlsxBuffer([
      ['Title', 'Category', 'Due Date'],
      ['Pay bill', 'Urgent', 46344],
      ['Pay bill', 'Urgent', 46344],
      ['Book dentist', 'Personal', 46351],
    ]);
    const existing = new Set([duplicateKey({ title: 'book dentist', dueDate: '2026-11-25' })]);
    const { rows } = parseImportFile(buf, 'tasks.xlsx', existing, duplicateKey);
    expect(rows.map((r) => r.status)).toEqual(['valid', 'duplicate', 'duplicate']);
    expect(rows[0].input).toMatchObject({ title: 'Pay bill', category: 'urgent', dueDate: '2026-11-18' });
  });

  it('rejects a file without a title column', () => {
    const { fileError } = parseImportFile(toBuffer('Foo,Bar\n1,2'), 'x.csv', new Set(), duplicateKey);
    expect(fileError).toMatch(/Title/);
  });
});

describe('export', () => {
  it('writes a Tasks sheet with real Excel dates and a Summary sheet', () => {
    const todos: Todo[] = [
      {
        id: '1',
        title: 'Prepare report',
        category: 'work',
        dueDate: '2026-11-17',
        dueTime: '18:00',
        completed: false,
        order: 1,
        createdAt: '2026-11-01T09:00:00.000Z',
        updatedAt: '2026-11-01T09:00:00.000Z',
      },
    ];
    const wb = buildTasksWorkbook(todos, 'All tasks');
    expect(wb.SheetNames).toEqual(['Tasks', 'Summary']);
    const due = wb.Sheets.Tasks['D2'];
    expect(due.t).toBe('n');
    expect(due.v).toBe(46343);
    const time = wb.Sheets.Tasks['E2'];
    expect(time.t).toBe('n');
    expect(time.v).toBe(0.75);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Tasks);
    expect(rows[0]).toMatchObject({ Title: 'Prepare report', Category: 'Work', Status: 'Open' });
  });
});
