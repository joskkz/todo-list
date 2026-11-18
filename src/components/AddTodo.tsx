'use client';

import { Modal } from 'antd';
import TodoForm, { type TodoFormValues } from './TodoForm';

interface Props {
  open: boolean;
  /** Pre-filled due date (e.g. the day picked in the calendar). */
  defaultDueDate?: string;
  onCancel: () => void;
  onSubmit: (values: TodoFormValues) => Promise<void>;
}

export default function AddTodo({ open, defaultDueDate, onCancel, onSubmit }: Props) {
  return (
    <Modal open={open} title="New task" onCancel={onCancel} footer={null} destroyOnHidden>
      {/* Unmounted when hidden, so every opening starts with a fresh form. */}
      <TodoForm defaultDueDate={defaultDueDate} onCancel={onCancel} onSubmit={onSubmit} />
    </Modal>
  );
}
