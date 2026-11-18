'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { listTodos, requestPersistentStorage } from '@/lib/todoRepository';
import type { Todo } from '@/lib/todo';

export interface TodosState {
  todos: Todo[];
  loading: boolean;
  /** Set when IndexedDB is unavailable (e.g. blocked by browser settings). */
  storageError?: string;
}

/**
 * Live list of all tasks. Re-renders whenever the database changes,
 * including changes made in another tab.
 */
export function useTodos(): TodosState {
  const [storageError, setStorageError] = useState<string>();

  const todos = useLiveQuery(async () => {
    try {
      return await listTodos();
    } catch (err) {
      setStorageError(err instanceof Error ? err.message : String(err));
      return [];
    }
  }, []);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  return { todos: todos ?? [], loading: todos === undefined, storageError };
}
