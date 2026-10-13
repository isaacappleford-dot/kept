import { SHOW_PAST_DAYS } from '../config/policies';
import type { Card } from '../data/types';
import { cardName, isWallet, nextCharge } from '../data/types';
import { priceCheck } from './policy';
import { daysBetween, type ISODate } from '../lib/dates';

/** return: window closing (or drop-off for a started return); price: price-drop refund window; refund: has a mailed refund arrived; charge: a trial/subscription charges. */
export type DeadlineKind = 'return' | 'warranty' | 'expires' | 'price' | 'refund' | 'charge';
export type Urgency = 'past' | 'week' | 'month' | 'later';

export interface Deadline {
  key: string;
  cardId: string;
  kind: DeadlineKind;
  date: ISODate;
  daysLeft: number;
  urgency: Urgency;
  store: string;
  name: string;
  /** Money at stake in cents: the price for returns, the balance for wallet items, the charge for subscriptions. */
  amount: number | null;
  card: Card;
}

export function urgencyOf(daysLeft: number): Urgency {
  if (daysLeft < 0) return 'past';
  if (daysLeft <= 7) return 'week';
  if (daysLeft <= 31) return 'month';
  return 'later';
}

/**
 * Every open deadline, soonest first. Recently passed returns/expiries are kept
 * briefly; an overdue refund check stays until it's answered.
 */
export function deadlines(cards: Card[], today: ISODate): Deadline[] {
  const out: Deadline[] = [];
  const push = (card: Card, kind: DeadlineKind, date: ISODate | null, amount: number | null, keepPast: boolean | 'always') => {
    if (!date) return;
    const daysLeft = daysBetween(today, date);
    if (daysLeft < 0 && keepPast !== 'always' && (!keepPast || daysLeft < -SHOW_PAST_DAYS)) return;
    out.push({
      key: `${card.id}:${kind}`,
      cardId: card.id,
      kind,
      date,
      daysLeft,
      // An overdue refund check is still to do, not "just missed".
      urgency: kind === 'refund' && daysLeft < 0 ? 'week' : urgencyOf(daysLeft),
      store: card.store,
      name: cardName(card),
      amount,
      card,
    });
  };
  for (const c of cards) {
    if (isWallet(c.kind)) {
      if (!c.used && (c.balance ?? 1) > 0) push(c, 'expires', c.expires, c.balance, true);
      continue;
    }
    if (c.kind === 'renewal') {
      if (!c.used) push(c, 'charge', nextCharge(c, today), c.total, true);
      continue;
    }
    if (c.returnStatus === 'returned') continue;
    if (c.returnStatus === 'returning') {
      // Mailed and dropped off: now it's about the refund. Otherwise the window still matters.
      if (c.returnMethod === 'mail' && c.droppedOffOn) push(c, 'refund', c.refundCheckOn, c.total, 'always');
      else push(c, 'return', c.returnBy, c.total, true);
      continue;
    }
    if (c.returnStatus === 'open') push(c, 'return', c.returnBy, c.total, true);
    const warranty = c.extendedWarrantyUntil && (!c.warrantyUntil || c.extendedWarrantyUntil > c.warrantyUntil) ? c.extendedWarrantyUntil : c.warrantyUntil;
    push(c, 'warranty', warranty, c.total, false);
    if (c.priceStatus !== 'done') push(c, 'price', priceCheck(c)?.until ?? null, c.total, false);
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name));
}

const KIND_ORDER: Record<DeadlineKind, number> = { refund: 0, return: 1, charge: 2, expires: 3, price: 4, warranty: 5 };

export interface DeadlineGroup {
  id: Urgency;
  title: string;
  items: Deadline[];
}

export function groupDeadlines(list: Deadline[]): DeadlineGroup[] {
  const titles: Record<Urgency, string> = { past: 'Just missed', week: 'This week', month: 'This month', later: 'Later' };
  const order: Urgency[] = ['week', 'month', 'later', 'past'];
  return order.map((id) => ({ id, title: titles[id], items: list.filter((d) => d.urgency === id) })).filter((g) => g.items.length);
}
