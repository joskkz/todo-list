'use client';

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, App, Button, Empty, Grid, Pagination, Select, Skeleton, Space, Table, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTodoQuery } from '@/hooks/useTodoQuery';
import { dueState } from '@/lib/dates';
import { PAGE_SIZES, canReorder, filterAndSort, paginate } from '@/lib/query';
import { sampleTodos } from '@/lib/sampleData';
import type { Todo } from '@/lib/todo';
import { moveId } from '@/lib/ordering';
import { bulkAddTodos, moveToEdge, moveTodo, saveManualOrder } from '@/lib/todoRepository';
import Filters from './Filters';
import { useTodoActions } from './TodoActions';
import TodoItem, { CompleteCheckbox, DragEnabledContext, DragHandle, RowActions, SortableRow, TaskTitle } from './TodoItem';
import { CategoryTag, DueDate } from './TaskBits';
import styles from './TodoList.module.css';

/** The list page: summary, filters, the task table and pagination. */
export default function TodoList() {
  const { message } = App.useApp();
  const { todos, loading, storageError, openAdd, openImport } = useTodoActions();
  const [query, setQuery] = useTodoQuery();
  const screens = Grid.useBreakpoint();
  const compact = !screens.md;
  // Rows shown while a move is being saved, so they don't jump back. It applies
  // until the stored data changes and, when the move also switches the sort to
  // Manual, until the URL shows Manual too.
  const [pending, setPending] = useState<{ base: Todo[]; ids: string[]; toManual: boolean } | null>(null);
  const pendingActive = !!pending && (pending.base === todos || (pending.toManual && query.sort !== 'manual'));
  // Once the save has landed, drop it so a later sort change isn't overridden.
  if (pending && !pendingActive) setPending(null);

  const counts = useMemo(() => {
    const active = todos.filter((t) => !t.completed).length;
    return {
      all: todos.length,
      active,
      completed: todos.length - active,
      overdue: todos.filter((t) => dueState(t.dueDate, t.completed) === 'overdue').length,
    };
  }, [todos]);

  const filtered = useMemo(() => filterAndSort(todos, query), [todos, query]);
  const page = paginate(filtered, query.page, query.size);
  const reorderable = canReorder(query) && !compact;

  const pendingIds = pendingActive ? pending!.ids : null;
  const items = useMemo(() => {
    if (!pendingIds) return page.items;
    const byId = new Map(todos.map((t) => [t.id, t]));
    return pendingIds.map((id) => byId.get(id)).filter((t): t is Todo => !!t);
  }, [page.items, pendingIds, todos]);

  // Keep the URL in step when the requested page no longer exists (e.g. after deleting).
  useEffect(() => {
    if (!loading && query.page !== page.page) setQuery({ page: page.page });
  }, [loading, query.page, page.page, setQuery]);

  /**
   * Moves a task onto another row, or to the top/bottom. In Manual order only the
   * moved task changes. In any other sort, the order on screen (with the move)
   * becomes the new manual order and the sort switches to Manual, so the list
   * stays as the user sees it instead of falling back to the old manual order.
   */
  async function handleMove(activeId: string, target: string | 'top' | 'bottom') {
    const toManual = query.sort !== 'manual';
    const fullIds = moveId(filtered.map((t) => t.id), activeId, target);
    const start = (page.page - 1) * query.size;
    // Edge moves in Manual order leave the page, so there is nothing to hold on screen.
    const ids = toManual ? fullIds.slice(start, start + query.size) : target === 'top' || target === 'bottom' ? null : moveId(items.map((t) => t.id), activeId, target);
    if (ids) setPending({ base: todos, ids, toManual });
    try {
      if (toManual) {
        await saveManualOrder(fullIds);
        setQuery({ sort: 'manual', page: page.page });
      } else if (target === 'top' || target === 'bottom') {
        await moveToEdge(activeId, target);
      } else {
        await moveTodo(activeId, target);
      }
    } catch (err) {
      setPending(null);
      message.error(`Could not save the new order: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function loadSamples() {
    const n = await bulkAddTodos(sampleTodos());
    message.success(`Added ${n} sample tasks`);
  }

  return (
    <>
      <div className={styles.heading}>
        <div>
          <h1 className={styles.h1}>My tasks</h1>
          <p className={styles.summary}>
            {counts.active} open · <span className={styles.overdueText}>{counts.overdue} overdue</span> · {counts.completed} completed
          </p>
        </div>
        <p className={styles.today}>{dayjs().format('dddd, D MMMM YYYY')}</p>
      </div>

      {storageError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title="Your browser is blocking local storage"
          description={`Tasks cannot be saved on this device (${storageError}). Check that site data is allowed, or try a normal (non-private) window.`}
        />
      )}

      <section className={styles.panel}>
        <Filters query={query} setQuery={setQuery} counts={counts} />

        {loading ? (
          <div style={{ padding: 24 }}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        ) : todos.length === 0 ? (
          <Empty
            className={styles.empty}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <>
                <strong>No tasks yet</strong>
                <br />
                Add your first task, import a file, or try the app with sample tasks.
              </>
            }
          >
            <Space wrap style={{ justifyContent: 'center' }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openAdd()}>
                Add task
              </Button>
              <Button icon={<DownloadOutlined />} onClick={openImport}>
                Import CSV / Excel
              </Button>
              <Button type="link" onClick={loadSamples}>
                Load sample tasks
              </Button>
            </Space>
          </Empty>
        ) : page.total === 0 ? (
          <Empty
            className={styles.empty}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <>
                <strong>No tasks match your filters</strong>
                <br />
                Try a different keyword or status.
              </>
            }
          >
            <Button onClick={() => setQuery({ q: '', status: 'all', category: 'all' })}>Clear filters</Button>
          </Empty>
        ) : (
          <>
            <TodoTable items={items} canReorder={reorderable} compact={compact} onMove={handleMove} />
            <div className={styles.footer}>
              <p className={styles.pageInfo}>
                Page <strong>{page.page}</strong> of <strong>{page.pages}</strong> · {page.total} {page.total === 1 ? 'task' : 'tasks'}
              </p>
              <Pagination
                current={page.page}
                total={page.total}
                pageSize={query.size}
                showSizeChanger={false}
                simple={compact ? { readOnly: true } : undefined}
                onChange={(p) => setQuery({ page: p })}
                itemRender={(_, type, original) => {
                  if (type === 'prev') return <Button size="small" type="text">‹ Previous</Button>;
                  if (type === 'next') return <Button size="small" type="text">Next ›</Button>;
                  return original;
                }}
              />
              <label className={styles.sizeLabel}>
                Tasks per page
                <Select
                  value={query.size}
                  style={{ width: 76 }}
                  onChange={(size) => setQuery({ size })}
                  options={PAGE_SIZES.map((n) => ({ value: n, label: n }))}
                  aria-label="Tasks per page"
                />
              </label>
            </div>
          </>
        )}
      </section>

      {!loading && todos.length > 0 && (
        <p className={styles.hint}>
          {compact
            ? 'Tasks are saved in this browser.'
            : 'Drag the handle to reorder when no search or filter is active. In a date sort, dragging keeps the order you see and switches to Manual order. Tasks are saved in this browser (IndexedDB).'}
        </p>
      )}
    </>
  );
}

interface TableProps {
  items: Todo[];
  canReorder: boolean;
  compact: boolean;
  onMove: (activeId: string, target: string | 'top' | 'bottom') => void;
}

/** Sortable table on wide screens, a card per task on narrow ones. */
function TodoTable({ items, canReorder, compact, onMove }: TableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
  }

  if (compact) {
    return (
      <ul className={styles.cards}>
        {items.map((t) => (
          <TodoItem key={t.id} todo={t} />
        ))}
      </ul>
    );
  }

  const columns: TableColumnsType<Todo> = [
    { key: 'drag', width: 44, render: (_, t) => <DragHandle title={t.title} /> },
    { key: 'done', width: 44, render: (_, t) => <CompleteCheckbox todo={t} /> },
    { title: 'Task', key: 'task', render: (_, t) => <TaskTitle todo={t} /> },
    {
      title: 'Category',
      key: 'category',
      width: 130,
      render: (_, t) => <CategoryTag category={t.category} />,
    },
    {
      title: 'Due date',
      key: 'due',
      width: 200,
      render: (_, t) => <DueDate dueDate={t.dueDate} dueTime={t.dueTime} completed={t.completed} />,
    },
    { title: <span className="sr-only">Actions</span>, key: 'actions', width: canReorder ? 132 : 100, align: 'right', render: (_, t) => <RowActions todo={t} onMove={canReorder ? (edge) => onMove(t.id, edge) : undefined} /> },
  ];

  return (
    <DragEnabledContext.Provider value={canReorder}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <Table<Todo>
            rowKey="id"
            columns={columns}
            dataSource={items}
            pagination={false}
            components={{ body: { row: SortableRow } }}
            rowClassName={(t) => (t.completed ? styles.rowDone : '')}
            scroll={{ x: 760 }}
            locale={{ emptyText: ' ' }}
            aria-label="Tasks"
          />
        </SortableContext>
      </DndContext>
    </DragEnabledContext.Provider>
  );
}
