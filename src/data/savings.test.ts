import { describe, expect, it } from 'vitest';
import { summarise } from './savings';

describe('summarise', () => {
  it('totals by kind and year', () => {
    const s = summarise(
      [
        { id: '1', cardId: 'a', kind: 'return', amount: 12000, date: '2026-10-01', label: '' },
        { id: '2', cardId: 'b', kind: 'coupon', amount: 1000, date: '2026-02-01', label: '' },
        { id: '3', cardId: 'c', kind: 'warranty', amount: 25000, date: '2025-06-01', label: '' },
      ],
      '2026-10-11',
    );
    expect(s.total).toBe(38000);
    expect(s.thisYear).toBe(13000);
    expect(s.byKind).toEqual({ return: 12000, warranty: 25000, coupon: 1000, price: 0, cancel: 0 });
  });
});
