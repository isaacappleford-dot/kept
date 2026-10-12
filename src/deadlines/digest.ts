import type { Card } from '../data/types';
import { cardName, KIND_LABEL } from '../data/types';
import { addDays, daysBetween, formatShort, weekday, weekdayName, type ISODate } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { clip } from '../../server/src/protocol';
import { deadlines, type Deadline } from './deadlines';
import { remindable } from './filters';

/** How far ahead the check-in looks for coupons and credit about to expire. */
export const DIGEST_WALLET_DAYS = 14;
/** Returns closing within this many days are on the check-in... */
export const DIGEST_RETURN_DAYS = 30;
/** ...and so is anything bought in the last two weeks (best time to decide), so long windows don't nag every week. */
export const DIGEST_RECENT_DAYS = 14;

export interface CheckinItems {
  /** Returns closing within 30 days of `day`, or bought in the two weeks before it; soonest first. */
  returns: Deadline[];
  /** Coupons / gift cards / credit expiring within two weeks of `day`. */
  expiring: Deadline[];
  /** Unused gift card + store credit balance (cents). */
  walletTotal: number;
  /** Return prices + expiring balances (cents). */
  atStake: number;
}

/** What a weekly check-in on `day` covers. */
export function checkinItems(cards: Card[], day: ISODate, minAmount: number): CheckinItems {
  const list = deadlines(cards, day).filter((d) => d.daysLeft >= 0 && remindable(d, minAmount));
  const returns = list.filter((d) => d.kind === 'return' && (d.daysLeft <= DIGEST_RETURN_DAYS || daysBetween(d.card.date, day) <= DIGEST_RECENT_DAYS));
  const expiring = list.filter((d) => d.kind === 'expires' && d.daysLeft <= DIGEST_WALLET_DAYS);
  const walletTotal = cards
    .filter((c) => (c.kind === 'giftcard' || c.kind === 'credit') && !c.used && (!c.expires || c.expires >= day))
    .reduce((sum, c) => sum + Math.max(0, c.balance ?? 0), 0);
  const atStake = [...returns, ...expiring].reduce((sum, d) => sum + Math.max(0, d.amount ?? 0), 0);
  return { returns, expiring, walletTotal, atStake };
}

function when(date: ISODate, day: ISODate): string {
  const n = daysBetween(day, date);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 7) return weekdayName(date).slice(0, 3);
  return formatShort(date, day);
}

function line(d: Deadline, day: ISODate, currency: string): string {
  if (d.kind === 'return') return `${clip(d.name, 40)} (return by ${when(d.date, day)})`;
  const money = d.amount ? `${formatMoney(d.amount, currency, { whole: true })} ` : '';
  const what = d.card.title && d.card.kind !== 'coupon' ? clip(cardName(d.card), 40) : KIND_LABEL[d.card.kind].toLowerCase();
  return `${money}${d.store ? `${d.store} ` : ''}${what} (expires ${when(d.date, day)})`;
}

/**
 * The Sunday check-in notification for `day`, or null when there's nothing to
 * decide that week (no returns open, nothing expiring), so quiet weeks stay quiet.
 */
export function weeklyDigest(cards: Card[], day: ISODate, currency: string, minAmount: number): { title: string; body: string } | null {
  const it = checkinItems(cards, day, minAmount);
  const items = [...it.returns, ...it.expiring].sort((a, b) => a.daysLeft - b.daysLeft);
  if (!items.length) return null;
  const title = it.atStake
    ? `Sunday check-in: ${formatMoney(it.atStake, currency, { whole: true })} you can still get back`
    : `Sunday check-in: ${items.length} thing${items.length === 1 ? '' : 's'} to decide`;
  const shown = items.slice(0, 3).map((d) => line(d, day, currency));
  if (items.length > 3) shown.push(`+${items.length - 3} more`);
  let body = `${shown.join(', ')}.`;
  if (it.walletTotal) body += ` ${formatMoney(it.walletTotal, currency, { whole: true })} on gift cards and credit.`;
  return { title, body };
}

/** The next `count` Sundays on or after `today`. */
export function upcomingSundays(today: ISODate, count: number): ISODate[] {
  const first = addDays(today, (7 - weekday(today)) % 7);
  return Array.from({ length: count }, (_, i) => addDays(first, i * 7));
}
