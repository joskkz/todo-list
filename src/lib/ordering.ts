/** Gap between order keys for new items and after a rebalance. */
export const ORDER_STEP = 1024;
/** Below this gap, midpoints lose precision and keys get renumbered. */
const MIN_GAP = 1e-6;

/**
 * Key for an item dropped between `before` and `after` (either may be missing
 * at the ends of the list). Only the moved item needs to be written.
 */
export function orderBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return ORDER_STEP;
  if (before === undefined) return (after as number) - ORDER_STEP;
  if (after === undefined) return before + ORDER_STEP;
  return (before + after) / 2;
}

export function needsRebalance(before: number | undefined, after: number | undefined): boolean {
  return before !== undefined && after !== undefined && Math.abs(after - before) < MIN_GAP;
}

/** Evenly spaced keys for items already in their desired order. */
export function rebalance<T extends { id: string }>(items: readonly T[]): { id: string; order: number }[] {
  return items.map((item, i) => ({ id: item.id, order: (i + 1) * ORDER_STEP }));
}

/**
 * Moves `activeId` to the position of `overId` within `items` (already sorted
 * by order) and returns the new order key for the moved item.
 */
export function orderForMove<T extends { id: string; order: number }>(
  items: readonly T[],
  activeId: string,
  overId: string,
): { order: number; rebalance: boolean; moved: T[] } | null {
  const from = items.findIndex((i) => i.id === activeId);
  const to = items.findIndex((i) => i.id === overId);
  if (from < 0 || to < 0 || from === to) return null;
  const moved = items.slice();
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item);
  const before = moved[to - 1]?.order;
  const after = moved[to + 1]?.order;
  return { order: orderBetween(before, after), rebalance: needsRebalance(before, after), moved };
}

/** Returns `ids` with `activeId` moved to where `overId` is (or to an edge). */
export function moveId(ids: readonly string[], activeId: string, target: string | 'top' | 'bottom'): string[] {
  const next = ids.filter((id) => id !== activeId);
  if (next.length === ids.length) return ids.slice();
  if (target === 'top') return [activeId, ...next];
  if (target === 'bottom') return [...next, activeId];
  const to = ids.indexOf(target);
  if (to < 0) return ids.slice();
  next.splice(to, 0, activeId);
  return next;
}
