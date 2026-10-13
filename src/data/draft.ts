import { createStore, useStore } from '../lib/store';
import type { ParsedReceipt } from '../scan/parseReceipt';
import type { FixedField } from '../scan/toDraft';
import type { CardDraft } from './types';

/** The card being reviewed after a scan / quick add, before it's saved. */
export interface DraftState {
  draft: CardDraft | null;
  image: { image: Blob; thumb: Blob } | null;
  /** Fields to double-check (from the parser). */
  unsure: ParsedReceipt['unsure'];
  /** Where it came from, for the review screen's heading. */
  source: 'scan' | 'pdf' | 'paste' | 'quick' | 'manual' | 'sample';
  /** Fields the user (or the quick-add sentence) set explicitly, so suggestions don't overwrite them. */
  fixed: FixedField[];
  /** Shown under "Return by" when the date came from the receipt ("From your receipt."). */
  returnNote: string | null;
}

export const draftStore = createStore<DraftState>({ draft: null, image: null, unsure: [], source: 'manual', fixed: [], returnNote: null });
export const useDraft = () => useStore(draftStore);
