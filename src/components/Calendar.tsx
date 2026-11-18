'use client';

import { EditOutlined, LeftOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { App, Button, Calendar as AntCalendar, Checkbox, Empty, Grid, Skeleton } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { type DragEvent, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ISO_DATE, compareTime, dueState } from '@/lib/dates';
import { CATEGORIES, CATEGORY_META, type Todo } from '@/lib/todo';
import { setCompleted, setDueDate } from '@/lib/todoRepository';
import styles from './Calendar.module.css';
import { CategoryDot, CategoryTag, CompletedIcon, DueSoonIcon, DueStatusLabel, OverdueIcon } from './TaskBits';
import { useTodoActions } from './TodoActions';

const PANEL_KEY = 'calendar.panelCollapsed';

/**
 * The day panel's collapsed state, remembered per browser in localStorage.
 * Read through useSyncExternalStore: the server snapshot (`false`) keeps
 * hydration stable, then React switches to the stored value on the client.
 */
const panelListeners = new Set<() => void>();
let panelFallback = false; // used when localStorage is unavailable

function readPanelCollapsed(): boolean {
  try {
    return localStorage.getItem(PANEL_KEY) === '1';
  } catch {
    return panelFallback;
  }
}

function writePanelCollapsed(collapsed: boolean) {
  panelFallback = collapsed;
  try {
    localStorage.setItem(PANEL_KEY, collapsed ? '1' : '0');
  } catch {}
  panelListeners.forEach((l) => l());
}

function subscribePanel(listener: () => void) {
  panelListeners.add(listener);
  // Keep other tabs in sync too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === PANEL_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    panelListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export default function Calendar() {
  const { todos, loading, openAdd, openEdit } = useTodoActions();
  const screens = Grid.useBreakpoint();
  const compact = !screens.md;
  const [selected, setSelected] = useState<Dayjs>(() => dayjs());
  const { message } = App.useApp();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dropCell = useRef<HTMLElement | null>(null);
  const panelCollapsed = useSyncExternalStore(subscribePanel, readPanelCollapsed, () => false);

  function togglePanel() {
    writePanelCollapsed(!panelCollapsed);
  }

  /** Tasks grouped by due date, built once per data change. */
  const byDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    // Within a day: tasks without a time first, then by time; ties keep manual order.
    const sorted = [...todos].sort((a, b) => compareTime(a.dueTime, b.dueTime) || a.order - b.order);
    for (const t of sorted) {
      if (!t.dueDate) continue;
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [todos]);

  const selectedIso = selected.format(ISO_DATE);
  const dayTasks = byDate.get(selectedIso) ?? [];
  const monthPrefix = selected.format('YYYY-MM');
  const monthOpen = todos.filter((t) => !t.completed && t.dueDate?.startsWith(monthPrefix)).length;

  /** Day cells are antd's <td title="YYYY-MM-DD">; find the one under the pointer. */
  function cellAt(e: DragEvent): HTMLElement | null {
    return (e.target as HTMLElement).closest<HTMLElement>('td.ant-picker-cell[title]');
  }

  function highlight(cell: HTMLElement | null) {
    if (dropCell.current === cell) return;
    dropCell.current?.classList.remove(styles.dropTarget);
    cell?.classList.add(styles.dropTarget);
    dropCell.current = cell;
  }

  function endDrag() {
    highlight(null);
    setDraggingId(null);
  }

  function onDragOver(e: DragEvent) {
    if (!draggingId) return;
    const cell = cellAt(e);
    highlight(cell);
    if (cell) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  }

  async function onDrop(e: DragEvent) {
    const cell = cellAt(e);
    const id = draggingId;
    endDrag();
    if (!cell || !id) return;
    e.preventDefault();
    const iso = cell.title;
    const task = todos.find((t) => t.id === id);
    if (!task || task.dueDate === iso) return;
    try {
      await setDueDate(id, iso);
      setSelected(dayjs(iso));
      message.success(`Moved to ${dayjs(iso).format('D MMM')}`);
    } catch (err) {
      message.error(`Could not move the task: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function renderCell(date: Dayjs) {
    const tasks = byDate.get(date.format(ISO_DATE)) ?? [];
    if (tasks.length === 0) return null;

    if (compact) {
      const cats = CATEGORIES.filter((c) => tasks.some((t) => t.category === c));
      return (
        <span className={styles.dots} aria-label={`${tasks.length} tasks`}>
          {cats.map((c) => (
            <CategoryDot key={c} category={c} size={6} />
          ))}
        </span>
      );
    }

    return (
      <ul className={styles.chips} aria-label={`${tasks.length} tasks`}>
        {tasks.map((t) => {
          const state = dueState(t.dueDate, t.completed);
          const tip = (t.dueTime ? `${t.dueTime} ` : '') + t.title + (state === 'overdue' ? ' (past due)' : state === 'soon' ? ' (due within 2 days)' : '');
          return (
            <li
              key={t.id}
              className={`${styles.chip} ${styles[`chip_${t.category}`]} ${t.completed ? styles.chipDone : ''} ${draggingId === t.id ? styles.chipDragging : ''}`}
              title={tip}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', t.title);
                setDraggingId(t.id);
              }}
              onDragEnd={endDrag}
            >
              <CategoryDot category={t.category} />
              {state === 'overdue' && <OverdueIcon size={12} />}
              {state === 'soon' && <DueSoonIcon size={12} />}
              <span className={styles.chipText}>
                {t.dueTime && <span className={styles.chipTime}>{t.dueTime}</span>}
                {t.title}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <Button icon={<LeftOutlined />} aria-label="Previous month" onClick={() => setSelected(selected.subtract(1, 'month').startOf('month'))} />
          <Button icon={<RightOutlined />} aria-label="Next month" onClick={() => setSelected(selected.add(1, 'month').startOf('month'))} />
          <Button onClick={() => setSelected(dayjs())}>Today</Button>
          <h1 className={styles.h1}>{selected.format('MMMM YYYY')}</h1>
          <span className={styles.monthOpen}>{monthOpen} open</span>
        </div>
        <div className={styles.toolbarRight}>
          <div className={styles.legend} aria-label="Category colours">
            {CATEGORIES.map((c) => (
              <span key={c} className={styles.legendItem}>
                <CategoryDot category={c} />
                {CATEGORY_META[c].label}
              </span>
            ))}
          </div>
          <Button
            icon={panelCollapsed ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={togglePanel}
            aria-expanded={!panelCollapsed}
            aria-controls="day-panel"
            title={panelCollapsed ? 'Show the task list for the selected day' : 'Hide the task list to enlarge the calendar'}
          >
            {compact ? null : panelCollapsed ? 'Show day tasks' : 'Hide day tasks'}
          </Button>
        </div>
      </div>

      <div className={styles.layout}>
        <section className={styles.calendar} onDragOver={onDragOver} onDrop={onDrop}>
          {loading ? (
            <div style={{ padding: 24 }}>
              <Skeleton active paragraph={{ rows: 10 }} />
            </div>
          ) : (
            <AntCalendar
              fullscreen={!compact}
              value={selected}
              onSelect={(d) => setSelected(d)}
              headerRender={() => null}
              cellRender={(date, info) => (info.type === 'date' ? renderCell(date) : info.originNode)}
            />
          )}
        </section>

        <aside id="day-panel" className={styles.panel} aria-labelledby="day-title" hidden={panelCollapsed}>
          <p className={styles.panelLabel}>Selected day</p>
          <h2 id="day-title" className={styles.panelTitle}>
            {selected.format('dddd, D MMMM')}
          </h2>
          <p className={styles.panelCount}>
            {dayTasks.length
              ? `${dayTasks.length} ${dayTasks.length === 1 ? 'task' : 'tasks'} · ${dayTasks.filter((t) => !t.completed).length} open`
              : 'No tasks'}
          </p>

          {dayTasks.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing due this day." />
          ) : (
            <ul className={styles.dayList}>
              {dayTasks.map((t) => (
                <li key={t.id} className={styles.dayItem}>
                  <Checkbox
                    checked={t.completed}
                    onChange={(e) => setCompleted(t.id, e.target.checked)}
                    aria-label={`Mark ${t.title} as ${t.completed ? 'not complete' : 'complete'}`}
                  />
                  <div className={styles.dayBody}>
                    <div className={styles.dayTitleLine}>
                      <span className={t.completed ? `${styles.dayTitle} ${styles.done}` : styles.dayTitle}>{t.title}</span>
                      {t.completed && <CompletedIcon />}
                    </div>
                    <div className={styles.dayMeta}>
                      <CategoryTag category={t.category} />
                      {t.dueTime && <span className={styles.dayTime}>{t.dueTime}</span>}
                      <DueStatusLabel dueDate={t.dueDate} completed={t.completed} />
                    </div>
                  </div>
                  <Button type="text" size="small" icon={<EditOutlined />} aria-label={`Edit ${t.title}`} onClick={() => openEdit(t)} />
                </li>
              ))}
            </ul>
          )}

          <Button block icon={<PlusOutlined />} style={{ marginTop: 14 }} onClick={() => openAdd(selectedIso)}>
            Add task on this day
          </Button>
        </aside>
      </div>
    </>
  );
}
