import { addCard, addSaving } from '../data/db';
import { emptyDraft, type CardDraft } from '../data/types';
import { addDays, addMonths, type ISODate } from '../lib/dates';

/** A handful of realistic cards so every screen has something to show. */
export function sampleDrafts(today: ISODate): CardDraft[] {
  const base = (p: Partial<CardDraft>): CardDraft => ({ ...emptyDraft(today), ...p });
  return [
    base({
      store: 'Target',
      title: 'Boots',
      date: addDays(today, -87),
      total: 12000,
      items: [{ name: 'Boots', price: 12000 }],
      category: 'shoes',
      returnBy: addDays(today, 3),
      notes: 'Size 9. Box in the hall closet.',
    }),
    base({
      store: 'Best Buy',
      title: 'Laptop',
      date: addMonths(today, -11),
      total: 89999,
      items: [{ name: '14" Laptop', price: 89999 }],
      category: 'computer',
      returnStatus: 'kept',
      returnBy: addDays(addMonths(today, -11), 15),
      warrantyUntil: addDays(today, 30),
      serial: 'C02XK1234567',
    }),
    base({
      store: 'Amazon',
      title: 'Cordless vacuum',
      date: addDays(today, -6),
      total: 34999,
      items: [{ name: 'Cordless Vacuum', price: 34999 }],
      category: 'appliance',
      online: true,
      deliveryDate: addDays(today, -3),
      returnBy: addDays(today, 27),
      warrantyUntil: addMonths(addDays(today, -3), 24),
    }),
    base({
      store: 'IKEA',
      title: 'Desk lamp',
      date: addDays(today, -20),
      total: 2999,
      category: 'home',
      returnBy: addDays(today, 160),
      giftFor: 'Sam',
    }),
    base({ kind: 'coupon', store: "Kohl's", title: '$10 off $50', total: 1000, balance: 1000, date: addDays(today, -10), expires: addDays(today, 5), code: 'SAVE10NOW' }),
    base({ kind: 'credit', store: 'Target', title: 'Store credit', total: 2500, balance: 2500, date: addDays(today, -30), expires: null }),
    base({ kind: 'giftcard', store: 'Starbucks', title: 'Gift card', total: 5000, balance: 1850, date: addDays(today, -60), expires: null, code: '6123 4567 8901' }),
  ];
}

export async function loadSampleData(today: ISODate) {
  for (const d of sampleDrafts(today)) await addCard(d);
  const jacket = await addCard({
    ...emptyDraft(today),
    store: 'Old Navy',
    title: 'Rain jacket',
    date: addDays(today, -40),
    total: 6000,
    category: 'clothing',
    returnStatus: 'returned',
    returnBy: addDays(today, -10),
  });
  await addSaving({ cardId: jacket.id, kind: 'return', amount: 6000, date: addDays(today, -12), label: 'Returned Rain jacket at Old Navy' });
}
