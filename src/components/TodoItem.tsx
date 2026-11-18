'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DeleteOutlined, EditOutlined, HolderOutlined, MoreOutlined } from '@ant-design/icons';
import { Button, Checkbox, Dropdown, Popconfirm, Tooltip } from 'antd';
import { createContext, useContext, useMemo, type CSSProperties, type HTMLAttributes } from 'react';
import type { Todo } from '@/lib/todo';
import { setCompleted } from '@/lib/todoRepository';
import styles from './TodoList.module.css';
import { CategoryTag, CompletedIcon, DueDate } from './TaskBits';
import { useTodoActions } from './TodoActions';

interface DragState {
  enabled: boolean;
  setActivatorNodeRef?: (el: HTMLElement | null) => void;
  listeners?: Record<string, (event: unknown) => void>;
}

const DragContext = createContext<DragState>({ enabled: false });

/** Whether rows in the surrounding list may be dragged. */
export const DragEnabledContext = createContext(false);

const DISABLED_TIP = 'Clear search and filters to drag';

export function DragHandle({ title }: { title: string }) {
  const { enabled, setActivatorNodeRef, listeners } = useContext(DragContext);
  return (
    <Tooltip title={enabled ? 'Drag to reorder (or focus and use Space + arrow keys)' : DISABLED_TIP}>
      <Button
        type="text"
        size="small"
        icon={<HolderOutlined />}
        ref={setActivatorNodeRef as never}
        className={enabled ? styles.handle : styles.handleOff}
        aria-label={`Reorder ${title}`}
        aria-disabled={!enabled}
        {...(enabled ? listeners : {})}
      />
    </Tooltip>
  );
}

/** Table row that dnd-kit can move. */
export function SortableRow(props: HTMLAttributes<HTMLTableRowElement> & { 'data-row-key': string }) {
  const enabled = useContext(DragEnabledContext);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props['data-row-key'],
    disabled: !enabled,
  });
  const style: CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9, background: '#fff', boxShadow: '0 6px 16px rgba(0,0,0,0.12)' } : {}),
  };
  const ctx = useMemo<DragState>(
    () => ({ enabled, setActivatorNodeRef, listeners: listeners as DragState['listeners'] }),
    [enabled, setActivatorNodeRef, listeners],
  );
  // The whole row is the sortable item, but only the handle starts a drag.
  return (
    <DragContext.Provider value={ctx}>
      <tr {...props} ref={setNodeRef} style={style} {...attributes} role={undefined} tabIndex={undefined} />
    </DragContext.Provider>
  );
}

export function CompleteCheckbox({ todo, className }: { todo: Todo; className?: string }) {
  return (
    <Checkbox
      checked={todo.completed}
      onChange={(e) => setCompleted(todo.id, e.target.checked)}
      aria-label={`Mark ${todo.title} as ${todo.completed ? 'not complete' : 'complete'}`}
      className={className}
    />
  );
}

export function RowActions({ todo, onMove }: { todo: Todo; onMove?: (edge: 'top' | 'bottom') => void }) {
  const { openEdit, deleteWithUndo } = useTodoActions();
  return (
    <div className={styles.actions}>
      <Tooltip title="Edit">
        <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(todo)} aria-label={`Edit ${todo.title}`} />
      </Tooltip>
      <Popconfirm
        title="Delete this task?"
        description="You can undo for a few seconds afterwards."
        okText="Delete"
        okButtonProps={{ danger: true }}
        onConfirm={() => deleteWithUndo(todo)}
      >
        <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Delete ${todo.title}`} />
      </Popconfirm>
      {onMove && (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'top', label: 'Move to top', onClick: () => onMove('top') },
              { key: 'bottom', label: 'Move to bottom', onClick: () => onMove('bottom') },
            ],
          }}
        >
          <Button type="text" icon={<MoreOutlined />} aria-label={`More actions for ${todo.title}`} />
        </Dropdown>
      )}
    </div>
  );
}

export function TaskTitle({ todo }: { todo: Todo }) {
  return (
    <div className={styles.titleCell}>
      <div className={styles.titleLine}>
        <span className={todo.completed ? `${styles.title} ${styles.done}` : styles.title}>{todo.title}</span>
        {todo.completed && <CompletedIcon />}
      </div>
      {todo.description && <div className={styles.desc}>{todo.description}</div>}
    </div>
  );
}

/** One task as a card, used by the compact (mobile) list. */
export default function TodoItem({ todo }: { todo: Todo }) {
  return (
    <li className={styles.card}>
      <CompleteCheckbox todo={todo} className={styles.cardCheck} />
      <div className={styles.cardBody}>
        <TaskTitle todo={todo} />
        <div className={styles.cardMeta}>
          <CategoryTag category={todo.category} />
          <DueDate dueDate={todo.dueDate} dueTime={todo.dueTime} completed={todo.completed} compact />
        </div>
      </div>
      <RowActions todo={todo} />
    </li>
  );
}
