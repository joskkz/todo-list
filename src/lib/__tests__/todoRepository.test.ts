import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import {
  addTodo,
  bulkAddTodos,
  deleteTodo,
  listTodos,
  moveTodo,
  restoreTodo,
  setCompleted,
  updateTodo,
} from '../todoRepository';

beforeEach(async () => {
  await db.todos.clear();
});

describe('todoRepository (IndexedDB)', () => {
  it('adds, updates, completes, deletes and restores', async () => {
    const t = await addTodo({ title: '  Write tests ', category: 'work', dueDate: '2026-11-20' });
    expect(t.title).toBe('Write tests');

    await updateTodo(t.id, { title: 'Write more tests', category: 'urgent' });
    let [saved] = await listTodos();
    expect(saved).toMatchObject({ title: 'Write more tests', category: 'urgent', dueDate: undefined });

    await setCompleted(t.id, true);
    [saved] = await listTodos();
    expect(saved.completed).toBe(true);
    expect(saved.completedAt).toBeDefined();

    const removed = await deleteTodo(t.id);
    expect(await listTodos()).toHaveLength(0);
    await restoreTodo(removed!);
    expect(await listTodos()).toHaveLength(1);
  });

  it('rejects invalid input', async () => {
    await expect(addTodo({ title: '   ', category: 'work' })).rejects.toThrow();
    await expect(addTodo({ title: 'x', category: 'work', dueDate: '2026-02-30' })).rejects.toThrow();
  });

  it('bulk import is all-or-nothing', async () => {
    await expect(
      bulkAddTodos([
        { title: 'ok', category: 'work' },
        { title: '', category: 'work' },
      ]),
    ).rejects.toThrow();
    expect(await listTodos()).toHaveLength(0);

    expect(await bulkAddTodos([{ title: 'a', category: 'work' }, { title: 'b', category: 'personal' }])).toBe(2);
    const titles = (await db.todos.orderBy('order').toArray()).map((t) => t.title);
    expect(titles).toEqual(['a', 'b']);
  });

  it('reorders with drag-and-drop', async () => {
    const a = await addTodo({ title: 'a', category: 'work' });
    await addTodo({ title: 'b', category: 'work' });
    const c = await addTodo({ title: 'c', category: 'work' });
    await moveTodo(c.id, a.id);
    const titles = (await db.todos.orderBy('order').toArray()).map((t) => t.title);
    expect(titles).toEqual(['c', 'a', 'b']);
  });
});
