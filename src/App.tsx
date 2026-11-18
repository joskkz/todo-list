'use client';

import { CalendarOutlined, DownloadOutlined, DownOutlined, PlusOutlined, UnorderedListOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Dropdown, Grid, Segmented, Space } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useTodoQuery } from '@/hooks/useTodoQuery';
import { filterAndSort, hasActiveFilters } from '@/lib/query';
import styles from './App.module.css';
import { useTodoActions } from '@/components/TodoActions';

export default function App({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const compact = !screens.md;
  const [query] = useTodoQuery();
  const { todos, openAdd, openImport, exportTasks } = useTodoActions();
  const view = pathname.startsWith('/calendar') ? 'calendar' : 'list';
  const filtered = view === 'list' && hasActiveFilters(query);

  const exportAll = () => exportTasks(todos, 'All tasks');
  const exportView = () => exportTasks(filterAndSort(todos, query), 'Current view (search and filters applied)');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={view === 'calendar' ? `${styles.headerInner} ${styles.wide}` : styles.headerInner}>
          <div className={styles.left}>
            <Link href="/" className={styles.brand} aria-label="Tasks home">
              <span className={styles.logo} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </span>
              <span className={styles.brandText}>Tasks</span>
            </Link>
            <Segmented
              aria-label="View"
              value={view}
              onChange={(v) => router.push(v === 'calendar' ? '/calendar' : '/')}
              options={[
                { value: 'list', label: compact ? undefined : 'List', icon: <UnorderedListOutlined />, title: 'List view' },
                { value: 'calendar', label: compact ? undefined : 'Calendar', icon: <CalendarOutlined />, title: 'Calendar view' },
              ]}
            />
          </div>
          <Space wrap size={8}>
            <Button icon={<DownloadOutlined />} onClick={openImport} aria-label="Import">
              {compact ? null : 'Import'}
            </Button>
            {filtered ? (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    { key: 'view', label: 'Current view (filtered)', onClick: exportView },
                    { key: 'all', label: 'All tasks', onClick: exportAll },
                  ],
                }}
              >
                <Button icon={<UploadOutlined />} aria-label="Export to Excel">
                  {compact ? null : (
                    <>
                      Export Excel <DownOutlined style={{ fontSize: 10 }} />
                    </>
                  )}
                </Button>
              </Dropdown>
            ) : (
              <Button icon={<UploadOutlined />} onClick={exportAll} aria-label="Export to Excel">
                {compact ? null : 'Export Excel'}
              </Button>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openAdd()}>
              Add task
            </Button>
          </Space>
        </div>
      </header>
      <main className={view === 'calendar' ? `${styles.main} ${styles.wide}` : styles.main}>{children}</main>
    </div>
  );
}
