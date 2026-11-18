'use client';

import { App, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import type { ReactNode } from 'react';
import { TodoActionsProvider } from './TodoActions';

// The en_US locale (dayjs "en") starts weeks on Sunday in the calendar and date picker.

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={enUS}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontFamily: 'var(--font-inter), system-ui, -apple-system, "Segoe UI", sans-serif',
        },
      }}
    >
      <App>
        <TodoActionsProvider>{children}</TodoActionsProvider>
      </App>
    </ConfigProvider>
  );
}
