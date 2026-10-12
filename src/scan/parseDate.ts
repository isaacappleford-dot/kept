import { addDays, addMonths, fromParts, lastWeekday, MONTHS, nextWeekday, WEEKDAYS, daysInMonth, parts, type ISODate } from '../lib/dates';

const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const monthIndex = (s: string) => MONTHS.indexOf(s.slice(0, 3).toLowerCase()) + 1;

function year(y: string | undefined): number | null {
  if (!y) return null;
  const n = Number(y);
  if (y.length === 2) return 2000 + n;
  return n;
}

export interface FoundDate {
  date: ISODate;
  index: number;
}

/**
 * All dates written in `text`, in order. Numeric dates are read US-style
 * (month first) unless that's impossible. Dates without a year take the
 * nearest year that isn't in the future (for receipts) or, with
 * `future`, the next occurrence (for expiry dates).
 */
export function findDates(text: string, today: ISODate, opts: { future?: boolean } = {}): FoundDate[] {
  const out: FoundDate[] = [];
  const seen = new Set<number>();
  const add = (d: ISODate | null, index: number) => {
    if (d && !seen.has(index)) {
      seen.add(index);
      out.push({ date: d, index });
    }
  };
  const noYear = (m: number, d: number): ISODate | null => {
    const [ty] = parts(today);
    const thisYear = fromParts(ty, m, d);
    if (!thisYear) return fromParts(ty + (opts.future ? 1 : -1), m, d);
    if (opts.future) return thisYear < today ? fromParts(ty + 1, m, d) : thisYear;
    return thisYear > today ? fromParts(ty - 1, m, d) : thisYear;
  };

  // 2026-10-11
  for (const m of text.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) add(fromParts(+m[1], +m[2], +m[3]), m.index!);
  // 10/11/2026, 10-11-26, 10.11.26
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g)) {
    const y = year(m[3])!;
    add(fromParts(y, +m[1], +m[2]) ?? fromParts(y, +m[2], +m[1]), m.index!);
  }
  // Oct 11, 2026 / October 11 2026 / Oct 11
  for (const m of text.matchAll(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'gi'))) {
    const mo = monthIndex(m[1]);
    add(m[3] ? fromParts(+m[3], mo, +m[2]) : noYear(mo, +m[2]), m.index!);
  }
  // 11 Oct 2026 / 11 October
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}(?:,?\\s+(\\d{4}))?\\b`, 'gi'))) {
    const mo = monthIndex(m[2]);
    add(m[3] ? fromParts(+m[3], mo, +m[1]) : noYear(mo, +m[1]), m.index!);
  }
  // 10/11 (no year)
  for (const m of text.matchAll(/(?<![\d/.-])(\d{1,2})\/(\d{1,2})(?![\d/.-])/g)) add(noYear(+m[1], +m[2]), m.index!);
  return out.sort((a, b) => a.index - b.index);
}

/**
 * Words people say: "today", "yesterday", "tomorrow", "Friday", "last Friday",
 * "next week", "end of the month", "in 3 weeks". Direction decides whether a bare
 * weekday means the next one ('future') or the last one ('past').
 */
export function parseRelative(text: string, today: ISODate, direction: 'future' | 'past'): ISODate | null {
  const t = text.toLowerCase();
  if (/\btoday\b|\btonight\b/.test(t)) return today;
  if (/\byesterday\b/.test(t)) return addDays(today, -1);
  if (/\btomorrow\b/.test(t)) return addDays(today, 1);
  const inN = /\bin (\d+|a|an|one|two|three) (day|week|month)s?\b/.exec(t);
  if (inN) {
    const n = /^\d+$/.test(inN[1]) ? +inN[1] : ({ a: 1, an: 1, one: 1, two: 2, three: 3 } as Record<string, number>)[inN[1]];
    return inN[2] === 'day' ? addDays(today, n) : inN[2] === 'week' ? addDays(today, 7 * n) : addMonths(today, n);
  }
  const ago = /\b(\d+|a|one|two|three) (day|week)s? ago\b/.exec(t);
  if (ago) {
    const n = /^\d+$/.test(ago[1]) ? +ago[1] : ({ a: 1, one: 1, two: 2, three: 3 } as Record<string, number>)[ago[1]];
    return addDays(today, -(ago[2] === 'week' ? 7 * n : n));
  }
  if (/\bnext week\b/.test(t)) return addDays(today, 7);
  if (/\blast week\b/.test(t)) return addDays(today, -7);
  if (/\bend of (the )?month\b/.test(t)) {
    const [y, m] = parts(today);
    return fromParts(y, m, daysInMonth(y, m));
  }
  if (/\bend of (the )?year\b/.test(t)) return `${today.slice(0, 4)}-12-31`;
  const wd = new RegExp(`\\b(last|next|this|on)?\\s*(${WEEKDAYS.join('|')}|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\\b`).exec(t);
  if (wd) {
    const idx = WEEKDAYS.findIndex((w) => w.startsWith(wd[2].slice(0, 3)));
    if (wd[1] === 'last' || (direction === 'past' && wd[1] !== 'next')) return lastWeekday(today, idx);
    return nextWeekday(today, idx, wd[1] === 'this');
  }
  return null;
}

