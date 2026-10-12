import type { ISODate } from '../lib/dates';
import type { CategoryId } from '../config/policies';

/** A purchase, or something for the Wallet (coupon, gift card, store credit). */
export type CardKind = 'purchase' | 'coupon' | 'giftcard' | 'credit';
export const WALLET_KINDS: CardKind[] = ['coupon', 'giftcard', 'credit'];
export const isWallet = (k: CardKind) => k !== 'purchase';

export const KIND_LABEL: Record<CardKind, string> = {
  purchase: 'Purchase',
  coupon: 'Coupon',
  giftcard: 'Gift card',
  credit: 'Store credit',
};

export interface LineItem {
  name: string;
  /** Cents, or null when unknown. */
  price: number | null;
}

export type ReturnStatus = 'open' | 'returned' | 'kept';

export interface Card {
  id: string;
  kind: CardKind;
  createdAt: number;
  updatedAt: number;

  store: string;
  /** What it is: "Vacuum", "$10 off $50", "Gift card". */
  title: string;
  /** Purchase date (or issue date for wallet items). */
  date: ISODate;
  /** Receipt total in cents (wallet: original value). */
  total: number | null;
  items: LineItem[];
  category: CategoryId;

  // Purchases
  online: boolean;
  /** Online orders: return clocks usually start at delivery. */
  deliveryDate: ISODate | null;
  returnBy: ISODate | null;
  returnStatus: ReturnStatus;
  warrantyUntil: ISODate | null;
  extendedWarrantyUntil: ISODate | null;

  // Wallet
  /** Remaining balance / coupon value in cents. */
  balance: number | null;
  code: string;
  expires: ISODate | null;
  used: boolean;

  // Notes
  serial: string;
  giftFor: string;
  /** Where the box is. */
  location: string;
  notes: string;

  hasImage: boolean;
  /** Text read from the receipt, kept for search. */
  ocrText: string;
}

export interface CardImage {
  id: string;
  image: Blob;
  thumb: Blob;
}

export type SavingKind = 'return' | 'warranty' | 'coupon';

export interface Saving {
  id: string;
  cardId: string;
  kind: SavingKind;
  amount: number;
  date: ISODate;
  label: string;
}

/** The fields a draft can carry before it becomes a Card. */
export type CardDraft = Omit<Card, 'id' | 'createdAt' | 'updatedAt'>;

export function emptyDraft(today: ISODate, kind: CardKind = 'purchase'): CardDraft {
  return {
    kind,
    store: '',
    title: '',
    date: today,
    total: null,
    items: [],
    category: 'other',
    online: false,
    deliveryDate: null,
    returnBy: null,
    returnStatus: 'open',
    warrantyUntil: null,
    extendedWarrantyUntil: null,
    balance: null,
    code: '',
    expires: null,
    used: false,
    serial: '',
    giftFor: '',
    location: '',
    notes: '',
    hasImage: false,
    ocrText: '',
  };
}

/** A short display name: "Boots", else the first item, else the store. */
export function cardName(c: Pick<Card, 'title' | 'items' | 'store' | 'kind'>): string {
  if (c.title.trim()) return c.title.trim();
  if (c.kind === 'purchase' && c.items[0]?.name) return c.items.length > 1 ? `${c.items[0].name} +${c.items.length - 1}` : c.items[0].name;
  return c.kind === 'purchase' ? c.store || 'Purchase' : KIND_LABEL[c.kind];
}
