import { CATEGORIES } from '../config/policies';
import type { CardKind, LineItem } from '../data/types';
import { findStore, guessCategory } from '../deadlines/policy';
import { daysBetween, type ISODate } from '../lib/dates';
import { parseAmount } from '../lib/money';
import { findDates, parseRelative } from './parseDate';

export interface ParsedReceipt {
  kind: CardKind;
  store: string;
  date: ISODate | null;
  total: number | null;
  items: LineItem[];
  category: (typeof CATEGORIES)[number]['id'];
  /** Expiry for coupons / gift cards / credit slips. */
  expires: ISODate | null;
  /** Coupon value, gift card / credit balance. */
  value: number | null;
  code: string;
  online: boolean;
  /** Online orders: when it arrived / will arrive. */
  deliveryDate: ISODate | null;
  /** An exact return deadline printed on the receipt ("Return by 01/15/2027"). */
  printedReturnBy: ISODate | null;
  /** A return window printed as a number of days ("Returns within 30 days"). */
  printedReturnDays: number | null;
  /** Fields we're unsure of; the review screen highlights them. */
  unsure: Array<'store' | 'date' | 'total' | 'items' | 'expires' | 'delivery'>;
}

const AMOUNT = String.raw`-?\$?\s?\d{1,3}(?:,\d{3})*[.,]\d{2}`;
const PRICE_AT_END = new RegExp(String.raw`^(.*?)\s+(${AMOUNT})\s*-?\s*[A-Z*]{0,3}$`);
const NOT_ITEM =
  /\b(sub\s*-?total|total|tax|cash|change|visa|master\s*card|mastercard|amex|discover|debit|credit|balance|tender|amount|payment|paid|card\s*#|auth|approv|savings|you saved|rounding|tip|gratuity|due|refund|points|rewards|loyalty|items sold|# items|ref\b|trans|account)/i;
const NOISE_LINE = /^[\W_]*$|^\*+|^(tel|phone|fax|www\.|http|store\s*#|st#|op#|ter#|tr#|cashier|register|receipt|thank you|thanks|welcome|survey|return policy)/i;

function cleanLines(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[|_]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

function amountsIn(line: string): number[] {
  return [...line.matchAll(new RegExp(AMOUNT, 'g'))].map((m) => parseAmount(m[0])).filter((n): n is number => n !== null);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(Llc|Inc|Co)\b/g, (w) => w)
    .trim();
}

function guessStoreName(lines: string[]): string | null {
  for (const l of lines.slice(0, 6)) {
    if (NOISE_LINE.test(l)) continue;
    const letters = l.replace(/[^a-z]/gi, '');
    const digits = l.replace(/\D/g, '');
    if (letters.length < 3 || digits.length > letters.length) continue;
    if (/\b(st|street|ave|avenue|rd|road|blvd|suite|ste|hwy|drive|dr)\b\.?/i.test(l) && /\d/.test(l)) continue;
    if (/^\d|receipt|invoice|order|date|time/i.test(l)) continue;
    if (/^(?:hello|hi|hey|dear)\b[\s,!]|^(?:thanks|thank you|your|we|this)\b/i.test(l)) continue; // email greetings
    const name = l.replace(/[^\w&' .-]/g, '').trim();
    if (name.length >= 3) return titleCase(name).slice(0, 40);
  }
  return null;
}

function findTotal(lines: string[]): { total: number | null; sure: boolean } {
  const ranked: Array<{ score: number; amount: number }> = [];
  lines.forEach((l, i) => {
    const amounts = amountsIn(l);
    const next = amounts.length ? amounts : amountsIn(lines[i + 1] ?? '');
    if (!next.length) return;
    const amount = next[next.length - 1];
    if (/grand\s*total|order\s*total|total\s*due|amount\s*due|balance\s*due|total\s*charged|total\s*paid/i.test(l)) ranked.push({ score: 3, amount });
    else if (/\btotal\b/i.test(l) && !/sub\s*-?total|total\s*(savings|saved|items|discount|tax|qty|quantity|before)|items/i.test(l)) ranked.push({ score: 2, amount });
  });
  if (ranked.length) {
    const top = Math.max(...ranked.map((r) => r.score));
    // The last strongest "total" line wins (receipts often repeat the total in the payment block).
    const best = ranked.filter((r) => r.score === top);
    return { total: Math.max(...best.map((b) => b.amount)), sure: true };
  }
  // Fall back to the largest amount that isn't cash handed over or change.
  const candidates = lines.filter((l) => !/cash|change|tender|saved|savings/i.test(l)).flatMap(amountsIn);
  return { total: candidates.length ? Math.max(...candidates) : null, sure: false };
}

function findItems(lines: string[]): LineItem[] {
  const items: LineItem[] = [];
  for (const l of lines) {
    const m = PRICE_AT_END.exec(l);
    if (!m) continue;
    let name = m[1];
    if (NOT_ITEM.test(name) || NOISE_LINE.test(name)) continue;
    if (/^\d+\s*@|\d+\s*@\s*\$?\d/.test(name) && name.replace(/[^a-z]/gi, '').length < 3) continue;
    name = name
      .replace(/\s+(N|NF|T|F|X|TX|FN|NT|TF)$/, '') // tax codes printed before the price
      .replace(/^\d{5,}\s*/, '') // leading SKU / UPC
      .replace(/\s+\d{6,}$/, '') // trailing UPC
      .replace(/^\d+\s*[xX@]\s+/, '') // "2 x"
      .replace(/[^\w&'"./%+ -]/g, '')
      .trim();
    if (name.replace(/[^a-z]/gi, '').length < 2) continue;
    const price = parseAmount(m[2]);
    if (price === null || price < 0) continue;
    items.push({ name: titleCase(name).slice(0, 60), price });
  }
  return items.slice(0, 40);
}

const PRICE_ONLY = new RegExp(String.raw`^(?:price:?\s*)?(${AMOUNT})$`, 'i');
const DETAIL_LINE = /^(qty|quantity|size|colou?r|sold by|seller|style|condition|item\s*#|sku|model|return eligible|arrives|delivered|ships)\b/i;

/**
 * Order emails often put the price on its own line under the item name
 * (sometimes with "Qty: 1" in between). Pairs each lone price with the nearest
 * item-like line above it.
 */
function findSplitItems(lines: string[], taken: Set<string>): LineItem[] {
  const items: LineItem[] = [];
  lines.forEach((l, i) => {
    const m = PRICE_ONLY.exec(l);
    if (!m) return;
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      const prev = lines[j];
      if (DETAIL_LINE.test(prev)) continue;
      if (PRICE_ONLY.test(prev) || NOT_ITEM.test(prev) || NOISE_LINE.test(prev) || PRICE_AT_END.test(prev)) return;
      if (/:\s*$/.test(prev) || /^(order|ship|deliver|billing|payment|item\(s\)|items?:)/i.test(prev)) return;
      const name = prev.replace(/[^\w&'"./%+ -]/g, '').trim();
      if (name.replace(/[^a-z]/gi, '').length < 3 || taken.has(name.toLowerCase())) return;
      const price = parseAmount(m[1]);
      if (price === null || price <= 0) return;
      taken.add(name.toLowerCase());
      items.push({ name: titleCase(name).slice(0, 60), price });
      return;
    }
  });
  return items;
}

// Everything below works one line at a time, so a phrase never borrows a date from another line.

const RETURN_BY_INLINE =
  /\b(?:returns?|exchanges?|refunds?)(?:[ \t]*(?:\/|&|and|or)[ \t]*(?:returns?|exchanges?|refunds?))?[ \t]*(?:accepted[ \t]+|eligible[ \t]+|allowed[ \t]+)?(?:by|before|until|thru|through|deadline|date|on or before)\b[: \t]*|\breturnable[ \t]+(?:until|through|by)\b[: \t]*|\breturn[ \t]+(?:policy[ \t]+expires|window[ \t]+(?:closes|ends))(?:[ \t]+on)?\b[: \t]*/i;
/** A table header like Home Depot's "POLICY ID  DAYS  POLICY EXPIRES ON" (dates are in the rows below). */
const POLICY_TABLE_HEADER = /policy[ \t]+expires(?:[ \t]+on)?[: \t]*$/i;

/** Lines that talk about returns, so their dates are never taken as the purchase date. */
function returnLineIndexes(lines: string[]): Set<number> {
  const out = new Set<number>();
  lines.forEach((l, i) => {
    if (POLICY_TABLE_HEADER.test(l)) for (let j = i; j <= Math.min(lines.length - 1, i + 6); j++) out.add(j);
    else if (RETURN_BY_INLINE.test(l)) {
      out.add(i);
      if (!l.replace(RETURN_BY_INLINE, '').trim()) out.add(i + 1);
    }
  });
  return out;
}

/**
 * "Return by 01/15/2027", "RETURN/EXCHANGE BY:" with the date on the next line,
 * or a "POLICY EXPIRES ON" table (the earliest row wins, since one item's
 * window may be shorter). The date must fall after the purchase.
 */
function findPrintedReturnBy(lines: string[], purchase: ISODate | null, today: ISODate): ISODate | null {
  const from = purchase ?? today;
  const ok = (d: ISODate) => {
    const span = daysBetween(from, d);
    return span >= 1 && span <= 730;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (POLICY_TABLE_HEADER.test(l)) {
      const dates = lines
        .slice(i + 1, i + 7)
        .flatMap((row) => findDates(row, today, { future: true }).map((d) => d.date))
        .filter(ok)
        .sort();
      if (dates.length) return dates[0];
      continue;
    }
    const m = RETURN_BY_INLINE.exec(l);
    if (!m) continue;
    const rest = l.slice(m.index + m[0].length);
    const where = rest.trim() ? rest : (lines[i + 1] ?? '');
    const found = findDates(where, today, { future: true }).map((d) => d.date).find(ok);
    if (found) return found;
  }
  return null;
}

const RETURN_DAYS_PATTERNS = [
  /\b(?:returns?|exchanges?)\b[^\d]{0,30}?within[ \t]+(\d{1,3})[ \t]*days/i,
  /\b(\d{1,3})[- \t]?days?[ \t]+(?:return|exchange|money[- \t]?back)/i,
  /\breturn[ \t]+(?:policy|period|window)[: \t-]*(\d{1,3})[ \t]*days/i,
  /\b(\d{1,3})[ \t]*days?[ \t]+(?:to|for)[ \t]+(?:returns?|exchanges?)\b/i,
];
/** Lines about refund processing or shipping times, not the return window. */
const NOT_A_WINDOW = /process|allow|post(?:ed|s)?\b|ship|deliver|business days|credited|appear|issued|transit/i;

/** "Returns accepted within 30 days": the longest window named on a return line. */
function findPrintedReturnDays(lines: string[]): number | null {
  const found: number[] = [];
  for (const l of lines) {
    if (NOT_A_WINDOW.test(l)) continue;
    for (const re of RETURN_DAYS_PATTERNS) {
      const n = Number(re.exec(l)?.[1]);
      if (n >= 1 && n <= 365) found.push(n);
    }
  }
  return found.length ? Math.max(...found) : null;
}

const DELIVERY_WORDS = /\b(arriving|arrives|arrived|delivered|estimated delivery|expected delivery|delivery date|delivery estimate|get it by|guaranteed delivery)\b(?:[ \t]+(?:on|by))?[: \t]*/gi;

/**
 * "Arriving Thursday", "Delivered October 10", "Arrives by Thu, Oct 15".
 * Future words count from the order date (an email pasted days later must not
 * shift them); "delivered" dates are in the past, so they count back from today.
 * `relative` is true when only words like "Thursday" or "tomorrow" were given.
 */
function findDelivery(lines: string[], ordered: ISODate | null, today: ISODate): { date: ISODate; relative: boolean } | null {
  const base = ordered ?? today;
  for (const l of lines) {
    for (const m of l.matchAll(new RegExp(DELIVERY_WORDS.source, 'gi'))) {
      const rest = l.slice(m.index! + m[0].length);
      const past = /arrived|delivered/i.test(m[1]);
      const exact = past ? findDates(rest, today)[0]?.date : findDates(rest, base, { future: true })[0]?.date;
      const date = exact ?? parseRelative(rest, past ? today : base, past ? 'past' : 'future');
      if (date && Math.abs(daysBetween(today, date)) <= 120) return { date, relative: !exact };
    }
  }
  return null;
}

const ORDER_DATE = /\border(?:ed)?[ \t]*(?:placed[ \t]+on|on|placed|date)\b[: \t]*/i;
const HAS_YEAR = /\b\d{4}\b|\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/;

/** "Ordered on September 28, 2026", "Order placed: Oct 1". Skips promos like "order on or before Dec 15". */
function findOrderDate(lines: string[], today: ISODate): { date: ISODate; explicitYear: boolean } | null {
  for (const l of lines) {
    const m = ORDER_DATE.exec(l);
    if (!m || /or before|\bnext\b|order by|\bfor\b.*\bdelivery\b/i.test(l)) continue;
    const rest = l.slice(m.index + m[0].length);
    const found = findDates(rest, today)[0]?.date;
    if (found && daysBetween(found, today) >= 0) return { date: found, explicitYear: HAS_YEAR.test(rest) };
  }
  return null;
}

function guessKind(text: string): CardKind {
  const t = text.toLowerCase();
  if (/store credit|merchandise credit|return credit|credit slip|merchandise card/.test(t)) return 'credit';
  if (/gift card|giftcard|egift/.test(t) && /balance|value|amount|card number|pin/.test(t)) return 'giftcard';
  // Order emails and receipts often carry promos in the footer: a total or order number means it's a purchase.
  const purchase = /\bsub\s*-?total\b|\border total\b|\bgrand total\b|\border[ \t]*(?:#|number\b|no\.?[ \t]*[:#]?[ \t]*\d)|\bitems? ordered\b/.test(t);
  if (/\bcoupon\b|% off|\$\s?\d+ off|off your next|valid (through|thru|until)|redeem|promo code|offer code/.test(t) && !purchase) return 'coupon';
  return 'purchase';
}

function findExpiry(text: string, today: ISODate): ISODate | null {
  const m = /(expires?|exp\.?|expiration|valid (?:through|thru|until)|use by|good (?:through|thru|until)|redeem by|ends)\b[:\s]*/i.exec(text);
  if (!m) return null;
  const after = text.slice(m.index, m.index + 60);
  return findDates(after, today, { future: true })[0]?.date ?? null;
}

function findValue(text: string, kind: CardKind): number | null {
  if (kind === 'coupon') {
    const off = /\$\s?(\d+(?:\.\d{2})?)\s*off/i.exec(text);
    if (off) return parseAmount(off[1]);
  }
  const bal = /(balance|value|amount|credit)[^\d$\n]{0,20}\$?\s?(\d{1,4}(?:[.,]\d{2}))/i.exec(text);
  if (bal) return parseAmount(bal[2]);
  const any = /\$\s?(\d{1,4}(?:\.\d{2})?)/.exec(text);
  return any ? parseAmount(any[1]) : null;
}

function findCode(text: string): string {
  const m = /(?:code|promo|coupon\s*#|card\s*(?:number|no\.?|#))[:#\s]*([A-Z0-9][A-Z0-9 -]{3,24}[A-Z0-9])/i.exec(text);
  return m ? m[1].replace(/\s{2,}/g, ' ').trim() : '';
}

/** Turns OCR (or PDF) text into a best-guess draft. Everything is checked by the user afterwards. */
export function parseReceipt(text: string, today: ISODate): ParsedReceipt {
  const lines = cleanLines(text);
  const joined = lines.join('\n');
  const known = findStore(lines.slice(0, 10).join(' ')) ?? findStore(joined);
  const storeGuess = known?.name ?? guessStoreName(lines);
  const kind = guessKind(joined);

  // Purchase date: the first plausible date (not in the future, not absurdly old)
  // outside return and delivery lines. An email's "Ordered on <date with year>"
  // wins; one without a year only fills in when nothing else was found.
  const skip = returnLineIndexes(lines);
  lines.forEach((l, i) => new RegExp(DELIVERY_WORDS.source, 'i').test(l) && skip.add(i));
  const fallback =
    lines
      .filter((_, i) => !skip.has(i))
      .flatMap((l) => findDates(l, today).map((d) => d.date))
      .find((d) => daysBetween(d, today) >= 0 && daysBetween(d, today) < 365 * 5) ?? null;
  const order = findOrderDate(lines, today);
  const date = order && (order.explicitYear || !fallback) ? order.date : (fallback ?? order?.date ?? null);

  const { total, sure } = findTotal(lines);
  let items: LineItem[] = [];
  if (kind === 'purchase') {
    items = findItems(lines);
    items.push(...findSplitItems(lines, new Set(items.map((i) => i.name.toLowerCase()))));
  }
  const category = guessCategory(...items.map((i) => i.name));
  const online = /order (number|#|no)|shipped|shipping|delivered|tracking|order confirmation|ordered on|arriving|estimated delivery/i.test(joined) || !!known?.online;
  const delivery = online ? findDelivery(lines, order?.date ?? date, today) : null;
  const printedReturnBy = kind === 'purchase' ? findPrintedReturnBy(lines, date, today) : null;
  const printedReturnDays = kind === 'purchase' && !printedReturnBy ? findPrintedReturnDays(lines) : null;

  const isWalletKind = kind !== 'purchase';
  const expires = isWalletKind ? findExpiry(joined, today) : null;
  const value = isWalletKind ? findValue(joined, kind) : null;

  const unsure: ParsedReceipt['unsure'] = [];
  if (!known) unsure.push('store');
  if (!date) unsure.push('date');
  if (!sure && !isWalletKind) unsure.push('total');
  if (!isWalletKind && items.length === 0) unsure.push('items');
  if (isWalletKind && !expires) unsure.push('expires');
  // "Arriving Thursday" is only as good as our guess at which Thursday.
  if (delivery?.relative) unsure.push('delivery');

  return {
    kind,
    store: storeGuess ?? '',
    date,
    total: isWalletKind ? value : total,
    items,
    category,
    expires,
    value,
    code: isWalletKind ? findCode(joined) : '',
    online,
    deliveryDate: delivery?.date ?? null,
    printedReturnBy,
    printedReturnDays,
    unsure,
  };
}
