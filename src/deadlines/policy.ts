import { CATEGORIES, categoryById, DEFAULT_RETURN_DAYS, MEMBERSHIPS, PRICE_CHECK_MIN, STORES, type CategoryId, type MembershipId, type StorePolicy } from '../config/policies';
import type { Card } from '../data/types';
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
  /** A holiday extension covers this purchase (so a hand-set date isn't the store's normal window). */
  holiday?: boolean;
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

/** The user's own settings that change suggestions. */
export interface SuggestPrefs {
  windows?: StoreWindows;
  memberships?: readonly MembershipId[];
  /** Months a credit card adds to manufacturer warranties (0 = none). */
  cardWarrantyMonths?: number;
}

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

export function suggestReturnBy(input: ReturnInput, prefs: SuggestPrefs = {}): ReturnSuggestion {
  const windows = prefs.windows ?? {};
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
    return { date, days: mine, reason: `You set ${name} to ${mine} days${what}.`, needsDelivery, holiday: !!holiday };
  }

  if (!policy) {
    return {
      date: addDays(start, DEFAULT_RETURN_DAYS),
      days: DEFAULT_RETURN_DAYS,
      reason: `${DEFAULT_RETURN_DAYS} days ${from} is a common window. Check the receipt.`,
      needsDelivery,
    };
  }
  let days = electronics && policy.electronicsDays !== undefined ? policy.electronicsDays : policy.returnDays;
  // Store cards and memberships: a longer window, or extra days on top.
  const perk = policy.perks?.find((p) => prefs.memberships?.includes(p.membership));
  const perkName = perk ? MEMBERSHIPS.find((m) => m.id === perk.membership)?.label : undefined;
  if (perk?.returnDays !== undefined) days = Math.max(days ?? 0, perk.returnDays);
  else if (perk?.extraDays && days !== null) days += perk.extraDays;
  if (days === null) {
    return { date: null, days: null, reason: `${policy.name} usually has no fixed return limit.`, needsDelivery };
  }
  const normal = addDays(start, days);
  const holiday = holidayUntil(policy, start);
  const date = maxDate(normal, holiday)!;
  const what = electronics && policy.electronicsDays !== undefined && !perk ? ' for electronics' : '';
  const reason =
    holiday && date === holiday
      ? `${policy.name} extends holiday returns to ${holiday.slice(5).replace('-', '/')}.`
      : perk
        ? `${days} days with your ${perkName}, ${from}.`
        : `${policy.name} usually allows ${days} days${what}, ${from}.`;
  return { date, days, reason, needsDelivery, holiday: !!holiday };
}

export interface WarrantySuggestion {
  date: ISODate | null;
  months: number;
  reason: string;
  /** With a credit card that extends warranties: the longer date. */
  extended: ISODate | null;
}

export function suggestWarranty(category: CategoryId, date: ISODate, cardWarrantyMonths = 0): WarrantySuggestion {
  const c = categoryById(category);
  if (!c.warrantyMonths) return { date: null, months: 0, reason: `${c.label} usually has no manufacturer warranty.`, extended: null };
  const years = c.warrantyMonths % 12 === 0 ? `${c.warrantyMonths / 12} year${c.warrantyMonths > 12 ? 's' : ''}` : `${c.warrantyMonths} months`;
  return {
    date: addMonths(date, c.warrantyMonths),
    months: c.warrantyMonths,
    reason: `Most ${c.label.toLowerCase()} comes with ${years} of coverage.`,
    extended: cardWarrantyMonths > 0 ? addMonths(date, c.warrantyMonths + cardWarrantyMonths) : null,
  };
}

export interface PriceCheck {
  /** Last day the store usually refunds a lower price. */
  until: ISODate;
  store: string;
}

/** Stores that usually refund the difference if their own price drops soon after you buy (bigger purchases only). */
export function priceCheck(card: Pick<Card, 'kind' | 'store' | 'date' | 'total' | 'returnBy' | 'category'>): PriceCheck | null {
  if (card.kind !== 'purchase' || (card.total ?? 0) < PRICE_CHECK_MIN || card.category === 'grocery') return null;
  const policy = findStore(card.store);
  if (!policy?.priceAdjustDays) return null;
  const until = policy.priceAdjustDays === 'return' ? card.returnBy : addDays(card.date, policy.priceAdjustDays);
  return until ? { until, store: policy.name } : null;
}

/** A link to look the item up: the store's own search, or a web shopping search. */
export function storeSearchUrl(store: string, query: string): string {
  const q = query.trim() || store;
  const template = findStore(store)?.search;
  if (template) return template.replace('{q}', encodeURIComponent(q));
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${store} ${q}`.trim())}`;
}

/** Same store, however it was typed: "TARGET T-1234" and "Target" match. */
export function sameStore(a: string, b: string): boolean {
  const key = (s: string) => (findStore(s)?.name ?? s).trim().toLowerCase().replace(/\s+/g, ' ');
  return !!a.trim() && key(a) === key(b);
}

/** Grocery stores (Kroger, Trader Joe's…): receipts from them count as groceries. */
export function isGroceryStore(store: string): boolean {
  return !!findStore(store)?.grocery;
}
