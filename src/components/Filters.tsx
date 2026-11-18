'use client';

import { Input, Segmented, Select } from 'antd';
import { useEffect, useState } from 'react';
import type { TodoQuery } from '@/lib/query';
import { CATEGORIES, CATEGORY_META } from '@/lib/todo';
import styles from './TodoList.module.css';
import { CategoryDot } from './TaskBits';

interface Props {
  query: TodoQuery;
  setQuery: (patch: Partial<TodoQuery>) => void;
  counts: { all: number; active: number; completed: number };
}

const SEARCH_DEBOUNCE_MS = 250;

export default function Filters({ query, setQuery, counts }: Props) {
  // Typing updates local state at once; the URL (and the list) follows after a short pause.
  const [search, setSearch] = useState(query.q);
  // When the URL changes from elsewhere (Back button, "Clear filters"), show its value.
  const [syncedQ, setSyncedQ] = useState(query.q);
  if (query.q !== syncedQ) {
    setSyncedQ(query.q);
    setSearch(query.q);
  }

  useEffect(() => {
    if (search === query.q) return;
    const id = setTimeout(() => setQuery({ q: search }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search, query.q, setQuery]);

  return (
    <div className={styles.toolbar}>
      <Input.Search
        className={styles.search}
        placeholder="Search title or description…"
        aria-label="Search tasks"
        allowClear
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onSearch={(v) => setQuery({ q: v })}
      />
      <Segmented
        aria-label="Status"
        value={query.status}
        onChange={(v) => setQuery({ status: v as TodoQuery['status'] })}
        options={[
          { value: 'all', label: <span>All <span className={styles.count}>{counts.all}</span></span> },
          { value: 'active', label: <span>Active <span className={styles.count}>{counts.active}</span></span> },
          { value: 'completed', label: <span>Completed <span className={styles.count}>{counts.completed}</span></span> },
        ]}
      />
      <Select
        aria-label="Category"
        className={styles.select}
        value={query.category}
        onChange={(v) => setQuery({ category: v })}
        options={[
          { value: 'all', label: 'All categories' },
          ...CATEGORIES.map((c) => ({
            value: c,
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <CategoryDot category={c} />
                {CATEGORY_META[c].label}
              </span>
            ),
          })),
        ]}
      />
      <Select
        aria-label="Sort"
        className={styles.sortSelect}
        value={query.sort}
        onChange={(v) => setQuery({ sort: v })}
        options={[
          { value: 'manual', label: 'Sort: Manual order' },
          { value: 'due_asc', label: 'Sort: Due date ↑ (earliest)' },
          { value: 'due_desc', label: 'Sort: Due date ↓ (latest)' },
          { value: 'urgent_due_desc', label: 'Sort: Urgent first, then due date ↓' },
        ]}
      />
    </div>
  );
}
