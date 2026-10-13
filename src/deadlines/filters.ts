import type { Deadline } from './deadlines';

/**
 * Whether a deadline deserves a notification. Coupons, gift cards and credit
 * always do; groceries never; other purchases only from `minAmount` cents up
 * (an unknown price still gets reminders). Everything still shows in Coming Up.
 */
export function remindable(d: Deadline, minAmount: number): boolean {
  // Wallet expiries, subscription charges and refund checks are always worth a heads-up.
  if (d.kind === 'expires' || d.kind === 'charge' || d.kind === 'refund') return true;
  if (d.card.category === 'grocery') return false;
  if (minAmount > 0 && d.amount !== null && d.amount < minAmount) return false;
  return true;
}
