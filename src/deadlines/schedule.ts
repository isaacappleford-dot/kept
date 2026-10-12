import { REMINDER_LEADS } from '../config/policies';
import type { Card } from '../data/types';
import { addDays, parts, type ISODate } from '../lib/dates';
import type { ScheduledReminder } from '../../server/src/protocol';
import { clip, DIGEST_PREFIX, MAX_BODY, MAX_REMINDERS, MAX_TITLE } from '../../server/src/protocol';
import type { Deadline } from './deadlines';
import { upcomingSundays, weeklyDigest } from './digest';
import { remindable } from './filters';
import { reminderText, stageFor } from './reminders';

/** Reminders are delivered at this local hour. */
export const REMINDER_HOUR = 9;
/** How many Sunday check-ins to schedule ahead (re-planned on every sync). */
export const DIGEST_WEEKS = 6;

/** Epoch ms of `hour`:00 local time on a calendar day. */
export function localTime(day: ISODate, hour = REMINDER_HOUR): number {
  const [y, m, d] = parts(day);
  return new Date(y, m - 1, d, hour, 0, 0, 0).getTime();
}

export interface ScheduleOptions {
  currency: string;
  cardUrl: (id: string) => string;
  /** No return/warranty reminders under this many cents (0 = all). */
  minAmount?: number;
  /** Adds a Sunday check-in for each coming week that has something to decide. */
  checkin?: { cards: Card[]; url: string };
}

/**
 * Every push reminder still to come, for the server to deliver while the app is
 * closed. The current stage goes out now (or at 9 am if it's earlier); later
 * stages at 9 am on their day. Keys match the on-device reminders, so nothing
 * is sent twice. The server bundles whatever is due at the same moment into one
 * notification.
 */
export function scheduleReminders(list: Deadline[], today: ISODate, now: number, opts: ScheduleOptions): ScheduledReminder[] {
  const out: ScheduledReminder[] = [];
  const minAmount = opts.minAmount ?? 0;
  for (const d of list) {
    if ((d.daysLeft < 0 && d.kind !== 'refund') || !remindable(d, minAmount)) continue;
    const current = stageFor(d);
    for (const lead of REMINDER_LEADS[d.kind]) {
      if (lead > d.daysLeft && lead !== current) continue;
      const isCurrent = lead === current;
      const day = isCurrent ? today : addDays(d.date, -lead);
      const left = isCurrent ? d.daysLeft : lead;
      const { title, body } = reminderText({ ...d, daysLeft: left }, day, opts.currency);
      out.push({
        key: `${d.cardId}:${d.kind}:${d.date}:${lead}`,
        fireAt: isCurrent ? Math.max(now, localTime(today)) : localTime(day),
        title,
        body,
        url: opts.cardUrl(d.cardId),
      });
    }
  }
  if (opts.checkin) {
    for (const sunday of upcomingSundays(today, DIGEST_WEEKS)) {
      const fireAt = localTime(sunday);
      if (fireAt <= now) continue; // never send this week's check-in late
      const digest = weeklyDigest(opts.checkin.cards, sunday, opts.currency, minAmount);
      if (digest) out.push({ key: `${DIGEST_PREFIX}${sunday}`, fireAt, ...digest, url: opts.checkin.url });
    }
  }
  // Never let one long card name make the server turn the whole list away.
  return out
    .sort((a, b) => a.fireAt - b.fireAt)
    .slice(0, MAX_REMINDERS)
    .map((r) => ({ ...r, title: clip(r.title, MAX_TITLE), body: clip(r.body, MAX_BODY) }));
}
