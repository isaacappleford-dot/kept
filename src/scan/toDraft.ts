import { emptyDraft, type CardDraft } from '../data/types';
import { suggestReturnBy, suggestWarranty } from '../deadlines/policy';
import type { ISODate } from '../lib/dates';
import type { ParsedReceipt } from './parseReceipt';
import type { QuickAdd } from './quickAdd';

export type FixedField = 'returnBy' | 'warrantyUntil';

/** Fills in suggested return / warranty dates, leaving fields the user set alone. */
export function withSuggestions(d: CardDraft, fixed: readonly FixedField[] = []): CardDraft {
  if (d.kind !== 'purchase') return d;
  const out = { ...d };
  if (!fixed.includes('returnBy')) out.returnBy = suggestReturnBy(d).date;
  if (!fixed.includes('warrantyUntil')) out.warrantyUntil = suggestWarranty(d.category, d.online && d.deliveryDate ? d.deliveryDate : d.date).date;
  return out;
}

export function draftFromReceipt(p: ParsedReceipt, text: string, today: ISODate): CardDraft {
  const d = emptyDraft(today, p.kind);
  d.store = p.store;
  d.date = p.date ?? today;
  d.items = p.items;
  d.category = p.category;
  d.online = p.online;
  d.ocrText = text.slice(0, 4000);
  if (p.kind === 'purchase') {
    d.total = p.total;
    if (p.items.length === 1) d.title = p.items[0].name;
    return withSuggestions(d);
  }
  d.total = p.value;
  d.balance = p.value;
  d.expires = p.expires;
  d.code = p.code;
  return d;
}

export function draftFromQuickAdd(q: QuickAdd, sentence: string, today: ISODate): { draft: CardDraft; fixed: FixedField[] } {
  const d = emptyDraft(today, q.kind);
  d.title = q.title;
  d.store = q.store;
  d.date = q.date;
  d.total = q.total;
  d.category = q.category;
  d.online = q.online;
  d.deliveryDate = q.deliveryDate;
  d.giftFor = q.giftFor;
  d.notes = '';
  d.ocrText = sentence;
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
  return { draft: withSuggestions(d, fixed), fixed };
}
