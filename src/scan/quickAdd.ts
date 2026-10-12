import type { CategoryId } from '../config/policies';
import type { CardKind } from '../data/types';
import { findStore, guessCategory } from '../deadlines/policy';
import { addDays, addMonths, type ISODate } from '../lib/dates';
import { parseAmount } from '../lib/money';
import { findDates, parseRelative } from './parseDate';

export interface QuickAdd {
  kind: CardKind;
  title: string;
  store: string;
  date: ISODate;
  total: number | null;
  category: CategoryId;
  online: boolean;
  deliveryDate: ISODate | null;
  /** Set when the sentence names a return window ("90-day return"). */
  returnBy: ISODate | null;
  /** Set when the sentence names a warranty ("2 year warranty"). */
  warrantyUntil: ISODate | null;
  expires: ISODate | null;
  giftFor: string;
}

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10, thirty: 30, sixty: 60, ninety: 90 };
const num = (s: string) => (/^\d+$/.test(s) ? +s : (NUM[s.toLowerCase()] ?? NaN));
const N = String.raw`(\d+|a|an|one|two|three|four|five|six|ten|thirty|sixty|ninety)`;

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Finds a date phrase after one of `words` ("expires Friday", "arrives Oct 20"). */
function dateAfter(text: string, words: RegExp, today: ISODate, direction: 'future' | 'past'): { date: ISODate; span: [number, number] } | null {
  const m = words.exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length, m.index + m[0].length + 40);
  const clause = rest.split(/[,;.]| and | but /)[0];
  const abs = findDates(clause, today, { future: direction === 'future' })[0];
  const date = abs?.date ?? parseRelative(clause, today, direction);
  return date ? { date, span: [m.index, m.index + m[0].length + clause.length] } : null;
}

/**
 * Reads a spoken or typed sentence:
 *   "Got a vacuum at Target, 90-day return"
 *   "$25 store credit at Target, expires Dec 31"
 *   "Headphones $120 from Best Buy yesterday, 2 year warranty"
 *   "Ordered boots on Amazon for $89, arrives Friday"
 */
export function parseQuickAdd(input: string, today: ISODate): QuickAdd {
  let text = ` ${input.trim().replace(/\s+/g, ' ')} `;
  const cut = (re: RegExp) => {
    text = text.replace(re, ' ');
  };

  // Kind
  let kind: CardKind = 'purchase';
  if (/store credit|merchandise credit|return credit/i.test(text)) kind = 'credit';
  else if (/gift ?card/i.test(text)) kind = 'giftcard';
  else if (/\bcoupon\b|\bvoucher\b|% off|\boff\b.*\bnext\b/i.test(text)) kind = 'coupon';

  // Deadlines first (they contain words that would confuse the title).
  let returnBy: ISODate | null = null;
  let warrantyUntil: ISODate | null = null;
  const ret = new RegExp(`${N}[- ]?(day|week|month)s?[- ](return|returns|return window|to return)`, 'i').exec(text) ?? new RegExp(`(?:return|returnable)(?: window)?(?: of| for| within)? ${N}[- ](day|week|month)s?`, 'i').exec(text);
  let retAmount: { n: number; unit: string } | null = null;
  if (ret) {
    const n = num(ret[1]);
    const unit = ret[2].toLowerCase();
    if (Number.isFinite(n)) retAmount = { n, unit };
    text = text.replace(ret[0], ' ');
  }
  const war = new RegExp(`${N}[- ]?(year|yr|month)s?[- ](?:extended )?(?:warranty|guarantee|coverage)`, 'i').exec(text) ?? new RegExp(`(?:warranty|guarantee)(?: of| for)? ${N}[- ](year|yr|month)s?`, 'i').exec(text);
  let warAmount: { months: number } | null = null;
  if (war) {
    const n = num(war[1]);
    if (Number.isFinite(n)) warAmount = { months: /month/i.test(war[2]) ? n : n * 12 };
    text = text.replace(war[0], ' ');
  }
  if (/lifetime warranty/i.test(text)) cut(/lifetime warranty/i);

  const expiry = dateAfter(text, /\b(expires?|expiring|exp|valid (?:until|through|thru)|good (?:until|through|thru)|use (?:it )?by|until)\b/i, today, 'future');
  if (expiry) text = text.slice(0, expiry.span[0]) + ' ' + text.slice(expiry.span[1]);

  const online = /\b(ordered|online|shipped|delivered|arrives?|arriving|delivery)\b/i.test(text) || false;
  const delivery = dateAfter(text, /\b(arrives?|arriving|arrived|delivered|delivery|comes|coming)\b(?: on)?/i, today, /arrived|delivered/i.test(text) ? 'past' : 'future');
  if (delivery) text = text.slice(0, delivery.span[0]) + ' ' + text.slice(delivery.span[1]);

  // Gift recipient
  let giftFor = '';
  const gift = /\b(?:a )?(?:gift|present) for ([A-Z][a-z]+|my \w+|mom|dad)/i.exec(text) ?? /\bfor (mom|dad|my \w+)\b/i.exec(text);
  if (gift) {
    giftFor = cap(gift[1]);
    text = text.replace(gift[0], ' ');
  }

  // Money
  let total: number | null = null;
  const money = /\$\s?(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s?(?:dollars|bucks|usd)\b/i.exec(text);
  if (money) {
    total = parseAmount(money[1] ?? money[2]);
    text = text.replace(money[0], ' ');
  }
  cut(/\b(for|worth|of|cost|costs|was|paid)\s+(?=[,.\s]*$)/i);

  // Store
  let store = '';
  const atStore = /\b(?:at|from|on|@)\s+((?:[A-Z0-9][\w'&.-]*)(?:\s+(?:[A-Z0-9][\w'&.-]*|&))*)/.exec(text) ?? /\b(?:at|from|@)\s+([a-z][\w'&.-]*(?:\s+[a-z][\w'&.-]*)?)/i.exec(text);
  const known = findStore(text);
  if (known) {
    store = known.name;
    const alias = new RegExp(`\\b(?:at|from|on|@)?\\s*(${known.aliases.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:'s)?\\b`, 'i');
    text = text.replace(alias, ' ');
  } else if (atStore) {
    store = atStore[1].replace(/[.,]$/, '').trim();
    text = text.replace(atStore[0], ' ');
  }

  // Purchase date
  let date = today;
  const dateWords = /\b(today|yesterday|last \w+day|on (?:mon|tue|wed|thu|fri|sat|sun)\w*|(\d+|a|one|two|three) (?:day|week)s? ago|last week)\b/i.exec(text);
  if (dateWords) {
    date = parseRelative(dateWords[0], today, 'past') ?? today;
    text = text.replace(dateWords[0], ' ');
  } else {
    const abs = findDates(text, today)[0];
    if (abs) {
      date = abs.date;
    }
  }

  if (retAmount) {
    const start = delivery?.date && online ? delivery.date : date;
    returnBy = retAmount.unit.startsWith('month') ? addMonths(start, retAmount.n) : addDays(start, retAmount.unit.startsWith('week') ? retAmount.n * 7 : retAmount.n);
  }
  if (warAmount) warrantyUntil = addMonths(date, warAmount.months);

  // Title: whatever is left once the fillers are gone.
  let title = text
    .replace(/\b(i|we|just|got|get|bought|buy|picked up|ordered|purchased|grabbed|new|some|my|our|a pair of|pair of|returned)\b/gi, ' ')
    .replace(/\b(store credit|merchandise credit|gift ?card|coupon|voucher)\b/gi, kind === 'purchase' ? '$&' : ' ')
    .replace(/\b(online|it|with|and|for|on|at|from|in|the|a|an)\b(?=[\s,.]*$)/gi, ' ')
    .replace(/^[\s,.;:-]*(a|an|the)\b/i, ' ')
    .replace(/[,.;:!]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  title = title.replace(/^(a|an|the|some)\s+/i, '').replace(/\s+(and|with|for|on|at|from|to|the|a|an)$/i, '');
  if (kind === 'coupon' && !title && total) title = 'Coupon';
  title = cap(title).slice(0, 60);

  const category = kind === 'purchase' ? guessCategory(title) : 'other';
  return {
    kind,
    title,
    store,
    date,
    total,
    category,
    online: online || !!known?.online,
    deliveryDate: delivery?.date ?? null,
    returnBy,
    warrantyUntil,
    expires: expiry?.date ?? null,
    giftFor,
  };
}
