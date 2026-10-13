import { useEffect, useState } from 'react';
import { getCard, getImage, listCards, listSavings, onDataChange } from './db';
import type { Card, CardImage, Saving } from './types';

/** Re-runs `load` whenever the data changes. undefined while loading. */
function useLive<T>(load: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const run = () =>
      void load()
        .then((v) => alive && setValue(v))
        .catch(() => alive && setValue(undefined));
    run();
    const off = onDataChange(run);
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

export const useCards = () => useLive<Card[]>(listCards, []);
export const useCard = (id: string) => useLive<Card | null>(async () => (await getCard(id)) ?? null, [id]);
export const useSavings = () => useLive<Saving[]>(listSavings, []);

/** Object URL for a card's receipt photo (thumb or full), revoked on unmount. */
export function useImageUrl(id: string | null, which: 'thumb' | 'image' = 'thumb'): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let u: string | null = null;
    let alive = true;
    void getImage(id).then((img) => {
      if (!alive || !img) return;
      u = URL.createObjectURL(img[which]);
      setUrl(u);
    });
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [id, which]);
  return url;
}

/** A card's stored pictures (receipt, and the return label if any). */
export const useCardImages = (id: string) => useLive<CardImage | null>(async () => (await getImage(id)) ?? null, [id]);
