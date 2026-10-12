import { APP } from '../config/app';
import { db, notify } from './db';
import type { Card, CardImage, Saving } from './types';

/**
 * Backups. Everything lives in this browser's storage, so a backup file is the
 * way to move to a new phone or survive clearing site data.
 */
export interface BackupFile {
  app: string;
  version: 1;
  exportedAt: string;
  cards: Card[];
  savings: Saving[];
  images: Array<{ id: string; image: string; thumb: string }>;
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

export async function exportBackup(): Promise<Blob> {
  const [cards, savings, images] = await Promise.all([db().cards.toArray(), db().savings.toArray(), db().images.toArray()]);
  const file: BackupFile = {
    app: APP.storagePrefix,
    version: 1,
    exportedAt: new Date().toISOString(),
    cards,
    savings,
    images: await Promise.all(images.map(async (i) => ({ id: i.id, image: await blobToDataUrl(i.image), thumb: await blobToDataUrl(i.thumb) }))),
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

/** Checks the shape of a parsed backup; returns an error message or null. */
export function validateBackup(x: unknown): string | null {
  if (!x || typeof x !== 'object') return 'This isn’t a backup file.';
  const b = x as Partial<BackupFile>;
  if (b.app !== APP.storagePrefix) return `This isn’t a ${APP.name} backup.`;
  if (b.version !== 1) return 'This backup is from a newer version. Update the app first.';
  if (!Array.isArray(b.cards) || !Array.isArray(b.savings) || !Array.isArray(b.images)) return 'This backup is damaged.';
  if (b.cards.some((c) => !c || typeof c.id !== 'string' || typeof c.kind !== 'string' || typeof c.date !== 'string')) return 'This backup is damaged.';
  if (b.images.some((i) => !i || typeof i.image !== 'string' || !i.image.startsWith('data:image/'))) return 'This backup is damaged.';
  return null;
}

/** Merges a backup into this device (same ids are overwritten). Returns how many cards were restored. */
export async function importBackup(file: Blob): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('This isn’t a backup file.');
  }
  const err = validateBackup(parsed);
  if (err) throw new Error(err);
  const b = parsed as BackupFile;
  const images: CardImage[] = await Promise.all(b.images.map(async (i) => ({ id: i.id, image: await dataUrlToBlob(i.image), thumb: await dataUrlToBlob(i.thumb) })));
  await db().transaction('rw', db().cards, db().images, db().savings, async () => {
    await db().cards.bulkPut(b.cards);
    await db().savings.bulkPut(b.savings);
    await db().images.bulkPut(images);
  });
  notify();
  return b.cards.length;
}
