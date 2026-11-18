'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { parseQuery, serializeQuery, type TodoQuery } from '@/lib/query';

/**
 * View state (search, filters, sort, page, page size) lives in the URL, so it
 * survives reloads, can be shared as a link and works with the Back button.
 */
export function useTodoQuery(): [TodoQuery, (patch: Partial<TodoQuery>) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = useMemo(() => parseQuery(params), [params]);

  const setQuery = useCallback(
    (patch: Partial<TodoQuery>) => {
      const next = { ...query, ...patch };
      // Changing anything other than the page goes back to page 1.
      if (!('page' in patch)) next.page = 1;
      const qs = serializeQuery(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [query, router, pathname],
  );

  return [query, setQuery];
}
