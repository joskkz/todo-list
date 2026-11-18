import { Tag } from 'antd';
import { dueState, formatDue } from '@/lib/dates';
import { CATEGORY_META, type Category } from '@/lib/todo';
import styles from './TaskBits.module.css';

/** Small coloured dot for a category. */
export function CategoryDot({ category, size = 8 }: { category: Category; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={styles.dot}
      style={{ width: size, height: size, background: CATEGORY_META[category].color }}
    />
  );
}

export function CategoryTag({ category }: { category: Category }) {
  return (
    <Tag color={CATEGORY_META[category].tag} className={styles.tag}>
      <CategoryDot category={category} />
      {CATEGORY_META[category].label}
    </Tag>
  );
}

/** Yellow circle with "!" — due today or within the next 2 days. */
export function DueSoonIcon({ size = 16, label = true }: { size?: number; label?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role={label ? 'img' : undefined} aria-label={label ? 'Due within 2 days' : undefined} aria-hidden={label ? undefined : true} className={styles.icon}>
      {label && <title>Due within 2 days</title>}
      <circle cx="12" cy="12" r="11" fill="#faad14" />
      <path d="M12 6.5v7" stroke="#612500" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="12" cy="17.3" r="1.5" fill="#612500" />
    </svg>
  );
}

/** Red triangle with "!" — past due. */
export function OverdueIcon({ size = 16, label = true }: { size?: number; label?: boolean }) {
  return (
    <svg width={size + 1} height={size} viewBox="0 0 26 24" role={label ? 'img' : undefined} aria-label={label ? 'Past due' : undefined} aria-hidden={label ? undefined : true} className={styles.icon}>
      {label && <title>Past due</title>}
      <path d="M11.3 2.2a2 2 0 0 1 3.4 0l10.6 18.3a2 2 0 0 1-1.7 3H2.4a2 2 0 0 1-1.7-3z" fill="#cf1322" />
      <path d="M13 8.5v6.5" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="13" cy="19" r="1.5" fill="#ffffff" />
    </svg>
  );
}

/** Green circled check shown after completed task titles. */
export function CompletedIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#389e0d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Completed" className={styles.icon}>
      <title>Completed</title>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8 12.5l2.8 2.8L16.2 9.6" />
    </svg>
  );
}

/** Due date label plus the due-soon / overdue indicator. */
export function DueDate({
  dueDate,
  dueTime,
  completed,
  compact = false,
}: {
  dueDate?: string;
  dueTime?: string;
  completed: boolean;
  compact?: boolean;
}) {
  const state = dueState(dueDate, completed);
  return (
    <span className={`${styles.due} ${dueDate ? '' : styles.muted}`}>
      {formatDue(dueDate)}
      {dueDate && dueTime && <span className={styles.dueTime}>{dueTime}</span>}
      {state === 'soon' && <DueSoonIcon size={compact ? 14 : 16} />}
      {state === 'overdue' && (
        <>
          <OverdueIcon size={compact ? 14 : 16} />
          {!compact && <span className={styles.badge}>Overdue</span>}
        </>
      )}
    </span>
  );
}

/** Icon + text, for places with room for words (day panels). */
export function DueStatusLabel({ dueDate, completed }: { dueDate?: string; completed: boolean }) {
  const state = dueState(dueDate, completed);
  if (state === 'soon') {
    return (
      <span className={`${styles.status} ${styles.soon}`}>
        <DueSoonIcon size={14} label={false} /> Due soon
      </span>
    );
  }
  if (state === 'overdue') {
    return (
      <span className={`${styles.status} ${styles.overdue}`}>
        <OverdueIcon size={14} label={false} /> Overdue
      </span>
    );
  }
  return null;
}
