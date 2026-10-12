import type { ISODate } from '../lib/dates';
import type { CategoryId } from '../config/policies';

/** A purchase, something for the Wallet (coupon, gift card, store credit), or a trial/subscription that will charge. */
export type CardKind = 'purchase' | 'coupon' | 'giftcard' | 'credit' | 'renewal';
export const WALLET_KINDS: CardKind[] = ['coupon', 'giftcard', 'credit'];
/** Coupons, gift cards and store credit (things with a balance you spend). */
export const isWallet = (k: CardKind) => k === 'coupon' || k === 'giftcard' || k === 'credit';

export const KIND_LABEL: Record<CardKind, string> = {
  purchase: 'Purchase',
  coupon: 'Coupon',
  giftcard: 'Gift card',
  credit: 'Store credit',
  renewal: 'Trial or subscription',
};

export interface LineItem {
  name: string;
  /** Cents, or null when unknown. */
  price: number | null;
}

/** open → (returning →) returned, or kept. "returning" = the user started a return that isn't finished. */
export type ReturnStatus = 'open' | 'returning' | 'returned' | 'kept';
export type ReturnMethod = 'store' | 'mail';
export type Repeat = 'none' | 'monthly' | 'yearly';

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
  /** How a started return is going back (in store, or by mail / drop-off). */
  returnMethod: ReturnMethod | null;
  /** Return label / QR code text, if typed in. A label photo is kept with the card's images. */
  returnCode: string;
  /** Mailed returns: when it was dropped off. */
  droppedOffOn: ISODate | null;
  /** Mailed returns: when to check that the refund arrived. */
  refundCheckOn: ISODate | null;
  /** Price-drop check: 'open' until the user says they checked (or got money back). */
  priceStatus: 'open' | 'done';
  warrantyUntil: ISODate | null;
  extendedWarrantyUntil: ISODate | null;

  // Wallet (and trials / subscriptions)
  /** Remaining balance / coupon value in cents. */
  balance: number | null;
  code: string;
  /** Wallet: expiry. Trials / subscriptions: the day it charges. */
  expires: ISODate | null;
  /** Wallet: used up. Trials / subscriptions: dealt with (cancelled, or keeping it). */
  used: boolean;
  /** Trials / subscriptions: how often it charges. */
  repeat: Repeat;
  /** Trials / subscriptions: what the user did (shown on the card). */
  renewalOutcome: 'cancelled' | 'kept' | null;

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
  /** Return label or QR code (screenshot / photo), shown big at drop-off. */
  label?: Blob;
}

export type SavingKind = 'return' | 'warranty' | 'coupon' | 'price' | 'cancel';

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
    returnMethod: null,
    returnCode: '',
    droppedOffOn: null,
    refundCheckOn: null,
    priceStatus: 'open',
    warrantyUntil: null,
    extendedWarrantyUntil: null,
    balance: null,
    code: '',
    expires: null,
    used: false,
    repeat: 'none',
    renewalOutcome: null,
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
  if (c.kind === 'renewal') return renewalName(c as Pick<Card, 'title' | 'store'>);
  if (c.title.trim()) return c.title.trim();
  if (c.kind === 'purchase' && c.items[0]?.name) return c.items.length > 1 ? `${c.items[0].name} +${c.items.length - 1}` : c.items[0].name;
  return c.kind === 'purchase' ? c.store || 'Purchase' : KIND_LABEL[c.kind];
}

/** "Netflix free trial": the service plus what it is, unless the title already names the service. */
export function renewalName(c: Pick<Card, 'title' | 'store'>): string {
  const title = c.title.trim();
  const store = c.store.trim();
  if (!store) return title || KIND_LABEL.renewal;
  if (!title || title.toLowerCase().includes(store.toLowerCase())) return title || store;
  return `${store} ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
}

/**
 * The next time a subscription charges: a monthly or yearly one that wasn't
 * dealt with rolls forward on its own (people usually just let it renew).
 */
export function nextCharge(c: Pick<Card, 'expires' | 'repeat' | 'used'>, today: string): string | null {
  if (!c.expires || c.used || c.repeat === 'none' || c.expires >= today) return c.expires;
  const [y, m, d] = c.expires.split('-').map(Number);
  const step = c.repeat === 'yearly' ? 12 : 1;
  for (let k = 1; k <= 1200; k++) {
    const total = y * 12 + (m - 1) + k * step;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    const next = `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
    if (next >= today) return next;
  }
  return c.expires;
}

/** Cards saved by older versions miss newer fields: fill them with defaults. */
export function normalizeCard(c: Card): Card {
  return { ...emptyDraft(c.date ?? ''), ...c } as Card;
}
