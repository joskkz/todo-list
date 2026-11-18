'use client';

import { Modal } from 'antd';
import type { Todo } from '@/lib/todo';
import TodoForm, { type TodoFormValues } from './TodoForm';

interface Props {
  open: boolean;
  /** The task being edited. */
  todo?: Todo;
  onCancel: () => void;
  onSubmit: (values: TodoFormValues) => Promise<void>;
}

export default function EditTodo({ open, todo, onCancel, onSubmit }: Props) {
  return (
    <Modal open={open && !!todo} title="Edit task" onCancel={onCancel} footer={null} destroyOnHidden>
      {/* Unmounted when hidden, so every opening starts from the task's current values. */}
      {todo && <TodoForm key={todo.id} editing={todo} onCancel={onCancel} onSubmit={onSubmit} />}
    </Modal>
  );
}
