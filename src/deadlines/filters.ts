import type { Deadline } from './deadlines';

/**
 * Whether a deadline deserves a notification. Coupons, gift cards and credit
 * always do; groceries never; other purchases only from `minAmount` cents up
 * (an unknown price still gets reminders). Everything still shows in Coming Up.
 */
export function remindable(d: Deadline, minAmount: number): boolean {
  if (d.kind === 'expires') return true;
  if (d.card.category === 'grocery') return false;
  if (minAmount > 0 && d.amount !== null && d.amount < minAmount) return false;
  return true;
}
