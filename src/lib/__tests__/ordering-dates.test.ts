import { describe, expect, it } from 'vitest';
import { dueState, formatDue, isValidIsoDate } from '../dates';
import { ORDER_STEP, needsRebalance, orderBetween, orderForMove, rebalance } from '../ordering';

describe('ordering', () => {
  it('puts keys between neighbours and at the ends', () => {
    expect(orderBetween(undefined, undefined)).toBe(ORDER_STEP);
    expect(orderBetween(1000, 2000)).toBe(1500);
    expect(orderBetween(undefined, 1000)).toBe(1000 - ORDER_STEP);
    expect(orderBetween(1000, undefined)).toBe(1000 + ORDER_STEP);
  });

  it('computes the moved item key for a drop', () => {
    const items = [
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
      { id: 'c', order: 3 },
    ];
    const down = orderForMove(items, 'a', 'c');
    expect(down?.moved.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(down?.order).toBe(3 + ORDER_STEP);

    const up = orderForMove(items, 'c', 'a');
    expect(up?.moved.map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(up?.order).toBe(1 - ORDER_STEP);

    const middle = orderForMove(items, 'c', 'b');
    expect(middle?.order).toBe(1.5);

    expect(orderForMove(items, 'a', 'a')).toBeNull();
  });

  it('asks for a rebalance when keys get too close', () => {
    expect(needsRebalance(1, 1 + 1e-9)).toBe(true);
    expect(needsRebalance(1, 2)).toBe(false);
    expect(rebalance([{ id: 'x' }, { id: 'y' }])).toEqual([
      { id: 'x', order: ORDER_STEP },
      { id: 'y', order: 2 * ORDER_STEP },
    ]);
  });
});

describe('dates', () => {
  const today = '2026-11-17';

  it('validates real calendar dates only', () => {
    expect(isValidIsoDate('2026-11-30')).toBe(true);
    expect(isValidIsoDate('2026-11-31')).toBe(false);
    expect(isValidIsoDate('2026-2-01')).toBe(false);
  });

  it('flags overdue and due-soon tasks, never completed ones', () => {
    expect(dueState('2026-11-16', false, today)).toBe('overdue');
    expect(dueState('2026-11-17', false, today)).toBe('soon');
    expect(dueState('2026-11-19', false, today)).toBe('soon');
    expect(dueState('2026-11-20', false, today)).toBe('later');
    expect(dueState('2026-11-10', true, today)).toBe('none');
    expect(dueState(undefined, false, today)).toBe('none');
  });

  it('formats relative labels', () => {
    expect(formatDue('2026-11-17', today)).toBe('Today');
    expect(formatDue('2026-11-18', today)).toBe('Tomorrow');
    expect(formatDue('2026-11-16', today)).toBe('Yesterday');
    expect(formatDue('2026-12-03', today)).toBe('3 Dec 2026');
    expect(formatDue(undefined, today)).toBe('No due date');
  });
});
