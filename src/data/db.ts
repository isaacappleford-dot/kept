import Dexie, { type EntityTable } from 'dexie';
import { APP } from '../config/app';
import { normalizeCard, type Card, type CardDraft, type CardImage, type Saving } from './types';

class KeptDB extends Dexie {
  cards!: EntityTable<Card, 'id'>;
  images!: EntityTable<CardImage, 'id'>;
  savings!: EntityTable<Saving, 'id'>;
  constructor() {
    super(`${APP.storagePrefix}-data`);
    this.version(1).stores({ cards: 'id, kind, date, createdAt', images: 'id', savings: 'id, cardId, date' });
  }
}

let instance: KeptDB | null = null;
export const db = () => (instance ??= new KeptDB());

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function addCard(draft: CardDraft, image?: { image: Blob; thumb: Blob } | null): Promise<Card> {
  const now = Date.now();
  const card: Card = { ...draft, id: newId(), createdAt: now, updatedAt: now, hasImage: !!image || draft.hasImage };
  await db().transaction('rw', db().cards, db().images, async () => {
    await db().cards.put(card);
    if (image) await db().images.put({ id: card.id, ...image });
  });
  notify();
  return card;
}

export async function updateCard(id: string, patch: Partial<Card>, image?: { image: Blob; thumb: Blob } | null) {
  await db().transaction('rw', db().cards, db().images, async () => {
    await db().cards.update(id, { ...patch, ...(image ? { hasImage: true } : {}), updatedAt: Date.now() });
    if (image) await db().images.put({ id, ...image });
  });
  notify();
}

export async function deleteCard(id: string) {
  await db().transaction('rw', db().cards, db().images, db().savings, async () => {
    await db().cards.delete(id);
    await db().images.delete(id);
    await db().savings.where('cardId').equals(id).delete();
  });
  notify();
}

export const getCard = async (id: string) => {
  const c = await db().cards.get(id);
  return c ? normalizeCard(c) : undefined;
};
export const getImage = (id: string) => db().images.get(id);
export const listCards = async () => (await db().cards.toArray()).map(normalizeCard);

/** Saves (or replaces) the return label / QR picture for a card. */
export async function setLabelImage(id: string, label: Blob | null) {
  await db().transaction('rw', db().images, async () => {
    const existing = await db().images.get(id);
    if (existing) {
      const next = { ...existing };
      if (label) next.label = label;
      else delete next.label;
      await db().images.put(next);
    } else if (label) {
      // No receipt photo: keep the label on its own.
      await db().images.put({ id, image: label, thumb: label, label });
    }
  });
  notify();
}
export const listSavings = () => db().savings.orderBy('date').reverse().toArray();

export async function addSaving(s: Omit<Saving, 'id'>) {
  await db().savings.put({ ...s, id: newId() });
  notify();
}

export async function deleteSaving(id: string) {
  await db().savings.delete(id);
  notify();
}

export async function deleteSavingsFor(cardId: string, kind: Saving['kind']) {
  await db().savings.where('cardId').equals(cardId).and((s) => s.kind === kind).delete();
  notify();
}

export async function clearAll() {
  await db().transaction('rw', db().cards, db().images, db().savings, async () => {
    await Promise.all([db().cards.clear(), db().images.clear(), db().savings.clear()]);
  });
  notify();
}

const listeners = new Set<() => void>();
export function onDataChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export function notify() {
  listeners.forEach((fn) => fn());
}
