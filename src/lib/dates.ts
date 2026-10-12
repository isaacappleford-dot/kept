/**
 * Calendar dates as local "YYYY-MM-DD" strings. Deadlines are whole days, so we
 * never carry times or time zones around: arithmetic happens on UTC day numbers.
 */
export type ISODate = string;

const DAY = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function fromParts(y: number, m: number, d: number): ISODate | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return null;
  if (d > daysInMonth(y, m)) return null;
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string') return false;
  const m = ISO_RE.exec(s);
  return !!m && fromParts(+m[1], +m[2], +m[3]) === s;
}

export function parts(iso: ISODate): [number, number, number] {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Bad date: ${iso}`);
  return [+m[1], +m[2], +m[3]];
}

/** Today in the device's local time zone. */
export function todayISO(now: Date = new Date()): ISODate {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function toDayNumber(iso: ISODate): number {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d) / DAY;
}

function fromDayNumber(n: number): ISODate {
  const dt = new Date(n * DAY);
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addDays(iso: ISODate, n: number): ISODate {
  return fromDayNumber(toDayNumber(iso) + n);
}

/** Adds calendar months, clamping to the end of shorter months (Jan 31 + 1 → Feb 28). */
export function addMonths(iso: ISODate, n: number): ISODate {
  const [y, m, d] = parts(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fromParts(ny, nm, Math.min(d, daysInMonth(ny, nm)))!;
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return toDayNumber(b) - toDayNumber(a);
}

export function weekday(iso: ISODate): number {
  return new Date(toDayNumber(iso) * DAY).getUTCDay();
}

export function maxDate(a: ISODate | null, b: ISODate | null): ISODate | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** The next given weekday strictly after `from` (or `from` itself when allowToday). */
export function nextWeekday(from: ISODate, day: number, allowToday = false): ISODate {
  let diff = (day - weekday(from) + 7) % 7;
  if (diff === 0 && !allowToday) diff = 7;
  return addDays(from, diff);
}

/** The most recent given weekday strictly before `from`. */
export function lastWeekday(from: ISODate, day: number): ISODate {
  let diff = (weekday(from) - day + 7) % 7;
  if (diff === 0) diff = 7;
  return addDays(from, -diff);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) fmtCache.set(key, (f = new Intl.DateTimeFormat(undefined, { ...opts, timeZone: 'UTC' })));
  return f;
}
const asDate = (iso: ISODate) => new Date(toDayNumber(iso) * DAY);

/** "Oct 14" this year, "Oct 14, 2027" otherwise. */
export function formatShort(iso: ISODate, today: ISODate = todayISO()): string {
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return fmt(sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }).format(asDate(iso));
}

/** "Tue, Oct 14, 2026" */
export function formatLong(iso: ISODate): string {
  return fmt({ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(asDate(iso));
}

export function weekdayName(iso: ISODate): string {
  return fmt({ weekday: 'long' }).format(asDate(iso));
}

/** "today", "tomorrow", "in 3 days", "Friday", "yesterday", "5 days ago". */
export function relativeDay(iso: ISODate, today: ISODate = todayISO()): string {
  const n = daysBetween(today, iso);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n < 0) return `${-n} days ago`;
  if (n < 7) return weekdayName(iso);
  return `in ${n} days`;
}

/** "3 days left", "Last day", "Ended 2 days ago" style countdown. */
export function countdown(daysLeft: number): string {
  if (daysLeft === 0) return 'Last day';
  if (daysLeft === 1) return '1 day left';
  if (daysLeft > 1) return daysLeft > 60 ? `${Math.round(daysLeft / 30)} months left` : `${daysLeft} days left`;
  return daysLeft === -1 ? 'Ended yesterday' : `Ended ${-daysLeft} days ago`;
}
