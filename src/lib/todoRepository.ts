import { db } from './db';
import { ORDER_STEP, orderForMove, rebalance } from './ordering';
import { todoInputSchema, type Todo, type TodoInput } from './todo';

/**
 * The only module that talks to storage. Swapping IndexedDB for a server API
 * later means changing this file, not the UI.
 */

function now(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

async function nextOrder(): Promise<number> {
  const last = await db.todos.orderBy('order').last();
  return (last?.order ?? 0) + ORDER_STEP;
}

export function listTodos(): Promise<Todo[]> {
  return db.todos.toArray();
}

export async function addTodo(input: TodoInput): Promise<Todo> {
  const data = todoInputSchema.parse(input);
  const ts = now();
  const todo: Todo = {
    id: newId(),
    ...data,
    completedAt: data.completed ? ts : undefined,
    order: await nextOrder(),
    createdAt: ts,
    updatedAt: ts,
  };
  await db.todos.add(todo);
  return todo;
}

export async function updateTodo(id: string, input: TodoInput): Promise<void> {
  const data = todoInputSchema.parse(input);
  await db.transaction('rw', db.todos, async () => {
    const existing = await db.todos.get(id);
    if (!existing) throw new Error('Task not found');
    const completed = input.completed ?? existing.completed;
    await db.todos.put({
      ...existing,
      title: data.title,
      description: data.description,
      category: data.category,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      completed,
      completedAt: completed ? (existing.completedAt ?? now()) : undefined,
      updatedAt: now(),
    });
  });
}

export async function setCompleted(id: string, completed: boolean): Promise<void> {
  const ts = now();
  await db.todos.update(id, { completed, completedAt: completed ? ts : undefined, updatedAt: ts });
}

/** Moves a task to another day (calendar drag and drop). `dueDate` is YYYY-MM-DD. */
export async function setDueDate(id: string, dueDate: string): Promise<void> {
  await db.todos.update(id, { dueDate, updatedAt: now() });
}

/** Returns the deleted task so the caller can offer Undo. */
export async function deleteTodo(id: string): Promise<Todo | undefined> {
  return db.transaction('rw', db.todos, async () => {
    const existing = await db.todos.get(id);
    await db.todos.delete(id);
    return existing;
  });
}

export async function restoreTodo(todo: Todo): Promise<void> {
  await db.todos.put(todo);
}

/**
 * Adds many tasks in one transaction: either all are saved or none are.
 * New tasks go after the existing ones, in file order.
 */
export async function bulkAddTodos(inputs: readonly TodoInput[]): Promise<number> {
  const parsed = inputs.map((i) => todoInputSchema.parse(i));
  return db.transaction('rw', db.todos, async () => {
    let order = await nextOrder();
    const ts = now();
    const todos: Todo[] = parsed.map((data) => {
      const todo: Todo = {
        id: newId(),
        ...data,
        completedAt: data.completed ? ts : undefined,
        order,
        createdAt: ts,
        updatedAt: ts,
      };
      order += ORDER_STEP;
      return todo;
    });
    await db.todos.bulkAdd(todos);
    return todos.length;
  });
}

/**
 * Drag-and-drop: places `activeId` where `overId` is. Usually writes one
 * record; renumbers everything only when the keys get too close together.
 */
export async function moveTodo(activeId: string, overId: string): Promise<void> {
  await db.transaction('rw', db.todos, async () => {
    const all = await db.todos.orderBy('order').toArray();
    const result = orderForMove(all, activeId, overId);
    if (!result) return;
    if (result.rebalance) {
      const updates = rebalance(result.moved);
      await db.todos.bulkUpdate(updates.map(({ id, order }) => ({ key: id, changes: { order } })));
    } else {
      await db.todos.update(activeId, { order: result.order, updatedAt: now() });
    }
  });
}

/**
 * Saves `ids` (every task, in the wanted order) as the manual order. Used when
 * a task is moved while the list is sorted by something else, so the sorted
 * view becomes the new manual order instead of the old one coming back.
 */
export async function saveManualOrder(ids: readonly string[]): Promise<void> {
  const updates = rebalance(ids.map((id) => ({ id })));
  await db.transaction('rw', db.todos, async () => {
    await db.todos.bulkUpdate(updates.map(({ id, order }) => ({ key: id, changes: { order } })));
  });
}

/** Moves a task to the very top or bottom of the manual order. */
export async function moveToEdge(id: string, edge: 'top' | 'bottom'): Promise<void> {
  await db.transaction('rw', db.todos, async () => {
    const first = await db.todos.orderBy('order').first();
    const last = await db.todos.orderBy('order').last();
    const order = edge === 'top' ? (first?.order ?? 0) - ORDER_STEP : (last?.order ?? 0) + ORDER_STEP;
    await db.todos.update(id, { order, updatedAt: now() });
  });
}

/** Key used to spot duplicates on import: same title and due date. */
export function duplicateKey(t: { title: string; dueDate?: string }): string {
  return `${t.title.trim().toLowerCase()}|${t.dueDate ?? ''}`;
}

/** Asks the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist?.();
    }
  } catch {
    // Not supported or denied: data still persists, just without the guarantee.
  }
}
