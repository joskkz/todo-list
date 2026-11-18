import Dexie, { type EntityTable } from 'dexie';
import type { Todo } from './todo';

/**
 * IndexedDB database, wrapped by Dexie. Bump the version number and add an
 * `.upgrade()` when the schema changes so existing data migrates.
 * (`completed` is not indexed: IndexedDB cannot index booleans.)
 */
export const db = new Dexie('todo-app') as Dexie & {
  todos: EntityTable<Todo, 'id'>;
};

db.version(1).stores({
  todos: 'id, dueDate, category, order, createdAt',
});
