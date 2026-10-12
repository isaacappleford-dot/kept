import { APP } from '../config/app';
import type { Deadline } from '../deadlines/deadlines';
import { reminderText } from '../deadlines/reminders';
import { addDays, type ISODate } from '../lib/dates';

/**
 * iCalendar export. A web app can't schedule notifications while it's closed,
 * but the phone's calendar can: each deadline becomes an all-day event with
 * alarms at 9 am a few days before and on the day before.
 */

export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

/** Folds lines longer than 75 octets (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curLen = 0;
  for (const ch of line) {
    const len = bytes.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (curLen + len > limit) {
      out.push(cur);
      cur = '';
      curLen = 0;
    }
    cur += ch;
    curLen += len;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const compact = (iso: ISODate) => iso.replace(/-/g, '');

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Alarm offsets before the all-day event's midnight start: "-PT15H" = 9 am the day before. */
export function alarmsFor(kind: Deadline['kind'], daysLeft: number): string[] {
  const at9 = (daysBefore: number) => (daysBefore === 0 ? 'PT9H' : `-P${daysBefore - 1}DT15H`);
  const days = { warranty: [30, 7], price: [1], refund: [0], charge: [3, 1], return: [3, 1, 0], expires: [3, 1, 0] }[kind];
  return days.filter((d) => d <= Math.max(daysLeft, 0)).map(at9);
}

export function buildICS(list: Deadline[], today: ISODate, now = new Date(), currency = 'USD'): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${APP.name}//Deadlines//EN`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${APP.name}`];
  for (const d of list) {
    if (d.daysLeft < 0) continue;
    const { title, body } = reminderText(d, today, currency);
    const summary = {
      return: `Return by: ${d.name}`,
      warranty: `Warranty ends: ${d.name}`,
      expires: `Expires: ${title.replace(/^Your /, '').replace(/ expires .*$/, '')}`,
      price: `Price-drop refund ends: ${d.name}`,
      refund: `Check refund: ${d.name}`,
      charge: `${d.name || 'Subscription'} ${/\btrial\b/i.test(d.card.title) ? 'ends' : 'renews'}`,
    }[d.kind];
    lines.push(
      'BEGIN:VEVENT',
      `UID:${d.cardId}-${d.kind}@${APP.storagePrefix}.app`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${compact(d.date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(d.date, 1))}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(`${d.store ? `${d.store}. ` : ''}${body}`)}`,
      'TRANSP:TRANSPARENT',
    );
    for (const trigger of alarmsFor(d.kind, d.daysLeft)) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
