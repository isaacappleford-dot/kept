import { REMINDER_LEADS } from '../config/policies';
import { addDays, parts, type ISODate } from '../lib/dates';
import type { ScheduledReminder } from '../../server/src/protocol';
import { MAX_REMINDERS } from '../../server/src/protocol';
import type { Deadline } from './deadlines';
import { reminderText, stageFor } from './reminders';

/** Reminders are delivered at this local hour. */
export const REMINDER_HOUR = 9;

/** Epoch ms of `hour`:00 local time on a calendar day. */
export function localTime(day: ISODate, hour = REMINDER_HOUR): number {
  const [y, m, d] = parts(day);
  return new Date(y, m - 1, d, hour, 0, 0, 0).getTime();
}

/**
 * Every push reminder still to come for these deadlines, for the server to deliver
 * while the app is closed. The current stage goes out now (or at 9 am if it's
 * earlier); later stages at 9 am on their day. Keys match the on-device reminders,
 * so nothing is sent twice.
 */
export function scheduleReminders(list: Deadline[], today: ISODate, now: number, currency: string, cardUrl: (id: string) => string): ScheduledReminder[] {
  const out: ScheduledReminder[] = [];
  for (const d of list) {
    if (d.daysLeft < 0) continue;
    const current = stageFor(d);
    for (const lead of REMINDER_LEADS[d.kind]) {
      if (lead > d.daysLeft && lead !== current) continue;
      const isCurrent = lead === current;
      const day = isCurrent ? today : addDays(d.date, -lead);
      const left = isCurrent ? d.daysLeft : lead;
      const { title, body } = reminderText({ ...d, daysLeft: left }, day, currency);
      out.push({
        key: `${d.cardId}:${d.kind}:${d.date}:${lead}`,
        fireAt: isCurrent ? Math.max(now, localTime(today)) : localTime(day),
        title,
        body,
        url: cardUrl(d.cardId),
      });
    }
  }
  return out.sort((a, b) => a.fireAt - b.fireAt).slice(0, MAX_REMINDERS);
}
