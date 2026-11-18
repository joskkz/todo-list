'use client';

import { App, Button } from 'antd';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTodos, type TodosState } from '@/hooks/useTodos';
import { downloadTasks } from '@/lib/exportTodos';
import type { Todo } from '@/lib/todo';
import { addTodo, deleteTodo, restoreTodo, updateTodo } from '@/lib/todoRepository';
import ImportModal from './ImportModal';
import AddTodo from './AddTodo';
import EditTodo from './EditTodo';
import type { TodoFormValues } from './TodoForm';

interface TodoActions extends TodosState {
  openAdd: (defaultDueDate?: string) => void;
  openEdit: (todo: Todo) => void;
  openImport: () => void;
  deleteWithUndo: (todo: Todo) => Promise<void>;
  exportTasks: (todos: readonly Todo[], scopeLabel: string) => void;
}

const Ctx = createContext<TodoActions | null>(null);

/** Shared task data plus the add/edit/import dialogs, used by every page. */
export function TodoActionsProvider({ children }: { children: ReactNode }) {
  const { message } = App.useApp();
  const state = useTodos();
  const [adding, setAdding] = useState<{ open: boolean; dueDate?: string }>({ open: false });
  const [editing, setEditing] = useState<{ open: boolean; todo?: Todo }>({ open: false });
  const [importOpen, setImportOpen] = useState(false);

  const openAdd = useCallback((dueDate?: string) => setAdding({ open: true, dueDate }), []);
  const openEdit = useCallback((todo: Todo) => setEditing({ open: true, todo }), []);
  const openImport = useCallback(() => setImportOpen(true), []);

  const deleteWithUndo = useCallback(
    async (todo: Todo) => {
      const removed = await deleteTodo(todo.id);
      if (!removed) return;
      const key = `deleted-${todo.id}`;
      message.open({
        key,
        type: 'success',
        duration: 5,
        content: (
          <span>
            Deleted “{todo.title}”
            <Button
              type="link"
              size="small"
              onClick={async () => {
                await restoreTodo(removed);
                message.destroy(key);
                message.success('Task restored');
              }}
            >
              Undo
            </Button>
          </span>
        ),
      });
    },
    [message],
  );

  const exportTasks = useCallback(
    (todos: readonly Todo[], scopeLabel: string) => {
      if (todos.length === 0) {
        message.info('There are no tasks to export.');
        return;
      }
      try {
        const name = downloadTasks(todos, scopeLabel);
        message.success(`Exported ${todos.length} ${todos.length === 1 ? 'task' : 'tasks'} to ${name}`);
      } catch (err) {
        message.error(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [message],
  );

  async function handleAdd(values: TodoFormValues) {
    try {
      await addTodo(values);
      message.success('Task added');
      setAdding({ open: false });
    } catch (err) {
      message.error(`Could not save the task: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleEdit(values: TodoFormValues) {
    if (!editing.todo) return;
    try {
      await updateTodo(editing.todo.id, values);
      message.success('Task updated');
      setEditing((e) => ({ ...e, open: false }));
    } catch (err) {
      message.error(`Could not save the task: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const value = useMemo(
    () => ({ ...state, openAdd, openEdit, openImport, deleteWithUndo, exportTasks }),
    [state, openAdd, openEdit, openImport, deleteWithUndo, exportTasks],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <AddTodo
        open={adding.open}
        defaultDueDate={adding.dueDate}
        onCancel={() => setAdding({ open: false })}
        onSubmit={handleAdd}
      />
      <EditTodo
        open={editing.open}
        todo={editing.todo}
        onCancel={() => setEditing((e) => ({ ...e, open: false }))}
        onSubmit={handleEdit}
      />
      <ImportModal open={importOpen} existing={state.todos} onClose={() => setImportOpen(false)} />
    </Ctx.Provider>
  );
}

export function useTodoActions(): TodoActions {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTodoActions must be used inside TodoActionsProvider');
  return ctx;
}
