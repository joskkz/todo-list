import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import Providers from '@/components/Providers';
import App from '@/App';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Tasks — To-Do List',
  description: 'Manage tasks with due dates, categories, search, import/export and a calendar view. Data stays in your browser.',
};

/** Static shell shown while the app streams in (prerendered as the page's initial HTML). */
function LoadingShell() {
  return (
    <div className="loading-shell" aria-busy="true" aria-live="polite">
      <div className="loading-header">
        <span className="loading-logo" aria-hidden="true" />
        <span className="loading-brand">Tasks</span>
      </div>
      <p className="loading-text">Loading your tasks…</p>
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {/*
          The antd style registry and the URL-driven views can't be prerendered
          (they use per-request values), so they stream in behind this boundary.
        */}
        <Suspense fallback={<LoadingShell />}>
          <AntdRegistry>
            <Providers>
              <App>{children}</App>
            </Providers>
          </AntdRegistry>
        </Suspense>
      </body>
    </html>
  );
}
