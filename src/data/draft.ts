import { createStore, useStore } from '../lib/store';
import type { ParsedReceipt } from '../scan/parseReceipt';
import type { CardDraft } from './types';

/** The card being reviewed after a scan / quick add, before it's saved. */
export interface DraftState {
  draft: CardDraft | null;
  image: { image: Blob; thumb: Blob } | null;
  /** Fields to double-check (from the parser). */
  unsure: ParsedReceipt['unsure'];
  /** Where it came from, for the review screen's heading. */
  source: 'scan' | 'pdf' | 'quick' | 'manual' | 'sample';
  /** Fields the user (or the quick-add sentence) set explicitly, so suggestions don't overwrite them. */
  fixed: Array<'returnBy' | 'warrantyUntil'>;
}

export const draftStore = createStore<DraftState>({ draft: null, image: null, unsure: [], source: 'manual', fixed: [] });
export const useDraft = () => useStore(draftStore);
