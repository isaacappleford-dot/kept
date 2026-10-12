import { CATEGORIES } from '../config/policies';
import type { CardKind, LineItem } from '../data/types';
import { findStore, guessCategory } from '../deadlines/policy';
import { daysBetween, type ISODate } from '../lib/dates';
import { parseAmount } from '../lib/money';
import { findDates } from './parseDate';

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
  /** Fields we're unsure of; the review screen highlights them. */
  unsure: Array<'store' | 'date' | 'total' | 'items' | 'expires'>;
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

function guessKind(text: string): CardKind {
  const t = text.toLowerCase();
  if (/store credit|merchandise credit|return credit|credit slip|merchandise card/.test(t)) return 'credit';
  if (/gift card|giftcard|egift/.test(t) && /balance|value|amount|card number|pin/.test(t)) return 'giftcard';
  if (/\bcoupon\b|% off|\$\s?\d+ off|off your next|valid (through|thru|until)|redeem|promo code|offer code/.test(t) && !/\bsubtotal\b/.test(t)) return 'coupon';
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

  // Purchase date: first plausible date that isn't in the future or absurdly old.
  const dates = findDates(joined, today).map((d) => d.date);
  const date = dates.find((d) => daysBetween(d, today) >= 0 && daysBetween(d, today) < 365 * 5) ?? null;

  const { total, sure } = findTotal(lines);
  const items = kind === 'purchase' ? findItems(lines) : [];
  const category = guessCategory(...items.map((i) => i.name));
  const online = /order (number|#|no)|shipped|shipping|delivery|deliver|tracking|order confirmation|ordered on/i.test(joined) || !!known?.online;

  const isWalletKind = kind !== 'purchase';
  const expires = isWalletKind ? findExpiry(joined, today) : null;
  const value = isWalletKind ? findValue(joined, kind) : null;

  const unsure: ParsedReceipt['unsure'] = [];
  if (!known) unsure.push('store');
  if (!date) unsure.push('date');
  if (!sure && !isWalletKind) unsure.push('total');
  if (!isWalletKind && items.length === 0) unsure.push('items');
  if (isWalletKind && !expires) unsure.push('expires');

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
    unsure,
  };
}
