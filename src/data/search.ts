import { categoryById } from '../config/policies';
import { cardName, KIND_LABEL, type Card } from './types';

export type Filter = 'all' | 'purchases' | 'wallet' | 'returnable' | 'returned';

/** Everything a person might type to find a receipt: "TV", "Best Buy", a serial, a gift recipient. */
function haystack(c: Card): string {
  return [cardName(c), c.title, c.store, KIND_LABEL[c.kind], categoryById(c.category).label, c.items.map((i) => i.name).join(' '), c.serial, c.giftFor, c.location, c.notes, c.code, c.ocrText, c.date]
    .join(' ')
    .toLowerCase();
}

export function searchCards(cards: Card[], query: string, filter: Filter, today: string): Card[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return cards
    .filter((c) => {
      switch (filter) {
        case 'purchases':
          return c.kind === 'purchase';
        case 'wallet':
          return c.kind !== 'purchase';
        case 'returnable':
          return c.kind === 'purchase' && (c.returnStatus === 'open' || c.returnStatus === 'returning') && !!c.returnBy && c.returnBy >= today;
        case 'returned':
          return c.kind === 'purchase' && c.returnStatus === 'returned';
        default:
          return true;
      }
    })
    .filter((c) => {
      if (!words.length) return true;
      const h = haystack(c);
      return words.every((w) => h.includes(w));
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}
