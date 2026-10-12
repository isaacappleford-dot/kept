import { CATEGORIES, categoryById, DEFAULT_RETURN_DAYS, STORES, type CategoryId, type StorePolicy } from '../config/policies';
import { addDays, addMonths, maxDate, parts, type ISODate } from '../lib/dates';

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9.'&-]+/g, ' ').trim()} `;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ALIAS_RES = new Map<string, RegExp>();
const aliasRe = (a: string) => {
  let re = ALIAS_RES.get(a);
  if (!re) ALIAS_RES.set(a, (re = new RegExp(`(?:^|[^a-z0-9])${escape(a)}(?=$|[^a-z0-9])`)));
  return re;
};

/** Finds a known store mentioned in `text` (a typed name or a whole receipt): the earliest whole-word match wins. */
export function findStore(text: string): StorePolicy | null {
  const t = norm(text);
  let best: { p: StorePolicy; at: number } | null = null;
  for (const p of STORES) {
    for (const a of p.aliases) {
      const m = aliasRe(a).exec(t);
      if (m && (!best || m.index < best.at)) best = { p, at: m.index };
    }
  }
  return best?.p ?? null;
}

const KEYWORD_RES = new Map<string, RegExp>();
const keywordRe = (k: string) => {
  let re = KEYWORD_RES.get(k);
  if (!re) KEYWORD_RES.set(k, (re = new RegExp(`\\b${escape(k)}(?:s|es)?\\b`)));
  return re;
};

/** Guesses a category from item names / the title. */
export function guessCategory(...texts: string[]): CategoryId {
  const t = texts.join(' ').toLowerCase();
  for (const c of CATEGORIES) if (c.keywords.some((k) => keywordRe(k).test(t))) return c.id;
  return 'other';
}

export interface ReturnSuggestion {
  date: ISODate | null;
  days: number | null;
  /** Where the suggestion came from, shown under the field. */
  reason: string;
  /** The clock should start at delivery but we don't know it yet. */
  needsDelivery: boolean;
}

export interface ReturnInput {
  store: string;
  date: ISODate;
  online: boolean;
  deliveryDate: ISODate | null;
  category: CategoryId;
}

/** Return windows the user chose for a store, in days, keyed by storeKey(). */
export type StoreWindows = Record<string, number>;

/** Key for a store's remembered window; electronics are remembered separately when the store treats them differently. */
export function storeKey(store: string, category: CategoryId): string | null {
  const known = findStore(store);
  const name = (known?.name ?? store).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!name) return null;
  const split = !!known && known.electronicsDays !== undefined && known.electronicsDays !== known.returnDays;
  return split && categoryById(category).electronics ? `${name}|electronics` : name;
}

/** Day the return clock starts: delivery for online orders when known, else the purchase date. */
export function returnClockStart(input: Pick<ReturnInput, 'date' | 'online' | 'deliveryDate' | 'store'>): ISODate {
  const online = input.online || !!findStore(input.store)?.online;
  return online && input.deliveryDate ? input.deliveryDate : input.date;
}

function holidayUntil(p: StorePolicy, start: ISODate): ISODate | null {
  const h = p.holiday;
  if (!h) return null;
  const [y] = parts(start);
  const md = start.slice(5);
  if (md < h.from || md > h.to) return null;
  return `${y + 1}-${h.until}`;
}

export function suggestReturnBy(input: ReturnInput, windows: StoreWindows = {}): ReturnSuggestion {
  const policy = findStore(input.store);
  const online = input.online || !!policy?.online;
  const start = online && input.deliveryDate ? input.deliveryDate : input.date;
  const needsDelivery = online && !input.deliveryDate;
  const electronics = !!categoryById(input.category).electronics;
  const from = online && input.deliveryDate ? 'from delivery' : 'from purchase';

  const key = storeKey(input.store, input.category);
  const mine = key ? windows[key] : undefined;
  if (mine !== undefined && mine > 0) {
    const holiday = policy ? holidayUntil(policy, start) : null;
    const date = maxDate(addDays(start, mine), holiday)!;
    const name = policy?.name ?? input.store.trim();
    const what = key!.endsWith('|electronics') ? ' for electronics' : '';
    return { date, days: mine, reason: `You set ${name} to ${mine} days${what}.`, needsDelivery };
  }

  if (!policy) {
    return {
      date: addDays(start, DEFAULT_RETURN_DAYS),
      days: DEFAULT_RETURN_DAYS,
      reason: `${DEFAULT_RETURN_DAYS} days ${from} is a common window. Check the receipt.`,
      needsDelivery,
    };
  }
  const days = electronics && policy.electronicsDays !== undefined ? policy.electronicsDays : policy.returnDays;
  if (days === null) {
    return { date: null, days: null, reason: `${policy.name} usually has no fixed return limit.`, needsDelivery };
  }
  const normal = addDays(start, days);
  const holiday = holidayUntil(policy, start);
  const date = maxDate(normal, holiday)!;
  const what = electronics && policy.electronicsDays !== undefined ? ' for electronics' : '';
  const reason =
    holiday && date === holiday
      ? `${policy.name} extends holiday returns to ${holiday.slice(5).replace('-', '/')}.`
      : `${policy.name} usually allows ${days} days${what}, ${from}.`;
  return { date, days, reason, needsDelivery };
}

export interface WarrantySuggestion {
  date: ISODate | null;
  months: number;
  reason: string;
}

export function suggestWarranty(category: CategoryId, date: ISODate): WarrantySuggestion {
  const c = categoryById(category);
  if (!c.warrantyMonths) return { date: null, months: 0, reason: `${c.label} usually has no manufacturer warranty.` };
  const years = c.warrantyMonths % 12 === 0 ? `${c.warrantyMonths / 12} year${c.warrantyMonths > 12 ? 's' : ''}` : `${c.warrantyMonths} months`;
  return { date: addMonths(date, c.warrantyMonths), months: c.warrantyMonths, reason: `Most ${c.label.toLowerCase()} comes with ${years} of coverage.` };
}
