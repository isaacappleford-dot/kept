import { SHOW_PAST_DAYS } from '../config/policies';
import type { Card } from '../data/types';
import { cardName, isWallet } from '../data/types';
import { daysBetween, type ISODate } from '../lib/dates';

export type DeadlineKind = 'return' | 'warranty' | 'expires';
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
  /** Money at stake in cents: the price for returns, the balance for wallet items. */
  amount: number | null;
  card: Card;
}

export function urgencyOf(daysLeft: number): Urgency {
  if (daysLeft < 0) return 'past';
  if (daysLeft <= 7) return 'week';
  if (daysLeft <= 31) return 'month';
  return 'later';
}

/** Every open deadline, soonest first. Recently passed returns/expiries are kept briefly. */
export function deadlines(cards: Card[], today: ISODate): Deadline[] {
  const out: Deadline[] = [];
  const push = (card: Card, kind: DeadlineKind, date: ISODate | null, amount: number | null, keepPast: boolean) => {
    if (!date) return;
    const daysLeft = daysBetween(today, date);
    if (daysLeft < 0 && (!keepPast || daysLeft < -SHOW_PAST_DAYS)) return;
    out.push({
      key: `${card.id}:${kind}`,
      cardId: card.id,
      kind,
      date,
      daysLeft,
      urgency: urgencyOf(daysLeft),
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
    if (c.returnStatus === 'returned') continue;
    if (c.returnStatus === 'open') push(c, 'return', c.returnBy, c.total, true);
    const warranty = c.extendedWarrantyUntil && (!c.warrantyUntil || c.extendedWarrantyUntil > c.warrantyUntil) ? c.extendedWarrantyUntil : c.warrantyUntil;
    push(c, 'warranty', warranty, c.total, false);
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name));
}

const KIND_ORDER: Record<DeadlineKind, number> = { return: 0, expires: 1, warranty: 2 };

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
