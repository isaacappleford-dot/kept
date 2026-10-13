import { emptyDraft, type CardDraft } from '../data/types';
import { findStore, isGroceryStore, returnClockStart, suggestReturnBy, suggestWarranty, type SuggestPrefs } from '../deadlines/policy';
import { addDays, type ISODate } from '../lib/dates';
import type { ParsedReceipt } from './parseReceipt';
import type { QuickAdd } from './quickAdd';

export type FixedField = 'returnBy' | 'warrantyUntil' | 'extendedWarrantyUntil';

/** Fills in suggested return / warranty dates, leaving fields the user set alone. */
export function withSuggestions(d: CardDraft, fixed: readonly FixedField[] = [], prefs: SuggestPrefs = {}): CardDraft {
  if (d.kind !== 'purchase') return d;
  const out = { ...d };
  if (!fixed.includes('returnBy')) out.returnBy = suggestReturnBy(d, prefs).date;
  const warranty = suggestWarranty(d.category, returnClockStart(d), prefs.cardWarrantyMonths);
  if (!fixed.includes('warrantyUntil')) out.warrantyUntil = warranty.date;
  // A credit card that extends warranties: fill in the longer date (or clear a stale one) unless the user set it.
  if (!fixed.includes('extendedWarrantyUntil') && prefs.cardWarrantyMonths) out.extendedWarrantyUntil = warranty.extended;
  return out;
}

/** Receipts from grocery stores count as groceries unless the items clearly say otherwise. */
function groceryCategory(store: string, category: CardDraft['category']): CardDraft['category'] {
  return isGroceryStore(store) && (category === 'other' || category === 'kitchen' || category === 'home') ? 'grocery' : category;
}

export interface ReceiptDraft {
  draft: CardDraft;
  fixed: FixedField[];
  /** Shown under "Return by" when the date came from the receipt itself. */
  returnNote: string | null;
}

export function draftFromReceipt(p: ParsedReceipt, text: string, today: ISODate, prefs: SuggestPrefs = {}): ReceiptDraft {
  const d = emptyDraft(today, p.kind);
  d.store = p.store;
  d.date = p.date ?? today;
  d.items = p.items;
  d.category = groceryCategory(p.store, p.category);
  d.online = p.online;
  d.deliveryDate = p.online ? p.deliveryDate : null;
  d.ocrText = text.slice(0, 4000);
  if (p.kind !== 'purchase') {
    d.total = p.value;
    d.balance = p.value;
    d.expires = p.expires;
    d.code = p.code;
    return { draft: d, fixed: [], returnNote: null };
  }
  d.total = p.total;
  if (p.items.length === 1) d.title = p.items[0].name;

  // What the receipt itself says beats general store policies: an exact date
  // always; "within N days" only for stores we don't know (a known store's line
  // is usually its general policy, which can be wrong for electronics).
  if (p.printedReturnBy) {
    d.returnBy = p.printedReturnBy;
    return { draft: withSuggestions(d, ['returnBy'], prefs), fixed: ['returnBy'], returnNote: 'From your receipt.' };
  }
  if (p.printedReturnDays && !findStore(p.store)) {
    d.returnBy = addDays(returnClockStart(d), p.printedReturnDays);
    return { draft: withSuggestions(d, ['returnBy'], prefs), fixed: ['returnBy'], returnNote: `Your receipt says ${p.printedReturnDays} days.` };
  }
  return { draft: withSuggestions(d, [], prefs), fixed: [], returnNote: null };
}

export function draftFromQuickAdd(q: QuickAdd, sentence: string, today: ISODate, prefs: SuggestPrefs = {}): { draft: CardDraft; fixed: FixedField[] } {
  const d = emptyDraft(today, q.kind);
  d.title = q.title;
  d.store = q.store;
  d.date = q.date;
  d.total = q.total;
  d.category = groceryCategory(q.store, q.category);
  d.online = q.online;
  d.deliveryDate = q.deliveryDate;
  d.giftFor = q.giftFor;
  d.notes = '';
  d.ocrText = sentence;
  if (q.kind === 'renewal') {
    d.expires = q.expires;
    d.repeat = q.repeat;
    return { draft: d, fixed: [] };
  }
  if (q.kind !== 'purchase') {
    d.balance = q.total;
    d.expires = q.expires;
    return { draft: d, fixed: [] };
  }
  const fixed: FixedField[] = [];
  if (q.returnBy) {
    d.returnBy = q.returnBy;
    fixed.push('returnBy');
  }
  if (q.warrantyUntil) {
    d.warrantyUntil = q.warrantyUntil;
    fixed.push('warrantyUntil');
  }
  return { draft: withSuggestions(d, fixed, prefs), fixed };
}
