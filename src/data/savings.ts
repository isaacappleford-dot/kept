import type { ISODate } from '../lib/dates';
import type { Saving, SavingKind } from './types';

export interface SavingsSummary {
  total: number;
  thisYear: number;
  byKind: Record<SavingKind, number>;
  count: number;
}

export function summarise(savings: Saving[], today: ISODate): SavingsSummary {
  const byKind: Record<SavingKind, number> = { return: 0, warranty: 0, coupon: 0, price: 0, cancel: 0 };
  let total = 0;
  let thisYear = 0;
  for (const s of savings) {
    total += s.amount;
    byKind[s.kind] += s.amount;
    if (s.date.slice(0, 4) === today.slice(0, 4)) thisYear += s.amount;
  }
  return { total, thisYear, byKind, count: savings.length };
}
