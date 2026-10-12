import type { Card } from '../data/types';
import { cardName, KIND_LABEL } from '../data/types';
import { categoryById } from '../config/policies';

export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  // Neutralise spreadsheet formulas (CSV injection) and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCSV(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const amount = (c: number | null) => (c === null ? '' : (c / 100).toFixed(2));

/** "Everything I own": one row per purchase, for insurance claims. */
export function inventoryCSV(cards: Card[]): string {
  const rows: unknown[][] = [['Item', 'Store', 'Purchased', 'Price', 'Category', 'Serial number', 'Warranty until', 'Status', 'Notes', 'Items on receipt']];
  for (const c of cards.filter((c) => c.kind === 'purchase' && c.returnStatus !== 'returned').sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([
      cardName(c),
      c.store,
      c.date,
      amount(c.total),
      categoryById(c.category).label,
      c.serial,
      c.extendedWarrantyUntil ?? c.warrantyUntil ?? '',
      c.returnStatus === 'kept' ? 'Kept' : 'Owned',
      c.notes,
      c.items.map((i) => `${i.name}${i.price !== null ? ` ${amount(i.price)}` : ''}`).join('; '),
    ]);
  }
  return toCSV(rows);
}

export function walletCSV(cards: Card[]): string {
  const rows: unknown[][] = [['Type', 'Store', 'Name', 'Balance', 'Code', 'Expires', 'Used']];
  for (const c of cards.filter((c) => c.kind !== 'purchase')) {
    rows.push([KIND_LABEL[c.kind], c.store, cardName(c), amount(c.balance), c.code, c.expires ?? '', c.used ? 'Yes' : 'No']);
  }
  return toCSV(rows);
}
