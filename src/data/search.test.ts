import { describe, expect, it } from 'vitest';
import { searchCards } from './search';
import { emptyDraft, type Card } from './types';

const today = '2026-10-11';
const card = (id: string, p: Partial<Card>): Card => ({ ...emptyDraft(today), id, createdAt: 0, updatedAt: 0, ...p });

const cards = [
  card('tv', { title: '55" TV', store: 'Best Buy', date: '2026-01-02', category: 'tv', serial: 'QN55X', returnBy: '2026-01-17' }),
  card('boots', { title: 'Boots', store: 'Target', date: '2026-10-01', returnBy: '2026-12-30' }),
  card('lamp', { items: [{ name: 'Desk lamp', price: 2999 }], store: 'IKEA', date: '2026-09-01', returnStatus: 'returned' }),
  card('cpn', { kind: 'coupon', store: "Kohl's", date: '2026-10-05', code: 'SAVE10' }),
];

describe('searchCards', () => {
  it('finds by item, store, serial and receipt text, newest first', () => {
    expect(searchCards(cards, 'tv', 'all', today).map((c) => c.id)).toEqual(['tv']);
    expect(searchCards(cards, 'best buy', 'all', today).map((c) => c.id)).toEqual(['tv']);
    expect(searchCards(cards, 'qn55', 'all', today).map((c) => c.id)).toEqual(['tv']);
    expect(searchCards(cards, 'lamp', 'all', today).map((c) => c.id)).toEqual(['lamp']);
    expect(searchCards(cards, '', 'all', today).map((c) => c.id)).toEqual(['cpn', 'boots', 'lamp', 'tv']);
  });

  it('filters', () => {
    expect(searchCards(cards, '', 'wallet', today).map((c) => c.id)).toEqual(['cpn']);
    expect(searchCards(cards, '', 'returnable', today).map((c) => c.id)).toEqual(['boots']);
    expect(searchCards(cards, '', 'returned', today).map((c) => c.id)).toEqual(['lamp']);
  });
});
