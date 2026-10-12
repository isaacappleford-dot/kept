import { draftStore } from '../data/draft';
import { emptyDraft, type CardKind } from '../data/types';
import { drawSampleReceipt } from '../demo/sampleReceipt';
import { todayISO } from '../lib/dates';
import { settingsStore } from '../settings';
import { canvasToBlob, decodeImage, prepareImage, release } from './image';
import { recognise } from './ocr';
import { parseReceipt } from './parseReceipt';
import { parseQuickAdd } from './quickAdd';
import { draftFromQuickAdd, draftFromReceipt, withSuggestions } from './toDraft';

export type Progress = (p: number, label: string) => void;

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

/** Photo / screenshot / PDF → a draft waiting on the review screen. */
export async function processFile(file: File, opts: { kindHint?: CardKind; read: boolean; onProgress: Progress }) {
  if (isPdf(file)) {
    opts.onProgress(0.2, 'Opening PDF');
    const { readPdf } = await import('./pdf');
    const { text, image, thumb } = await readPdf(file);
    finish(text, image && thumb ? { image, thumb } : null, 'pdf', opts.kindHint);
    return;
  }
  opts.onProgress(0.05, 'Preparing photo');
  const src = await decodeImage(file);
  const prepared = await prepareImage(src);
  let text = '';
  if (opts.read) {
    try {
      text = await recognise(prepared.ocr, (p, status) => opts.onProgress(0.1 + 0.9 * (status.startsWith('recogniz') ? p : p * 0.2), labelFor(status)));
    } catch {
      text = '';
    }
  }
  release(prepared.ocr);
  finish(text, { image: prepared.image, thumb: prepared.thumb }, 'scan', opts.kindHint);
}

/** The built-in sample receipt, through the same path as a real photo. */
export async function processSample(onProgress: Progress) {
  const canvas = drawSampleReceipt(todayISO());
  const blob = await canvasToBlob(canvas, 'image/png');
  release(canvas);
  await processFile(new File([blob], 'sample.png', { type: 'image/png' }), { read: true, onProgress });
  draftStore.set({ source: 'sample' });
}

function labelFor(status: string) {
  if (status.startsWith('recogniz')) return 'Reading the receipt';
  if (status.includes('language') || status.includes('core') || status.includes('api')) return 'Loading the text reader';
  return 'Reading the receipt';
}

const windows = () => settingsStore.get().storeWindows;

/** Text copied from an order email (or from a receipt photo with Live Text) → a draft. */
export function processText(text: string) {
  finish(text, null, 'paste');
}

function finish(text: string, image: { image: Blob; thumb: Blob } | null, source: 'scan' | 'pdf' | 'paste', kindHint?: CardKind) {
  const today = todayISO();
  const parsed = parseReceipt(text, today);
  // "Scan a coupon" with nothing coupon-like detected: still a wallet item, never a purchase.
  if (kindHint && kindHint !== 'purchase' && parsed.kind === 'purchase') {
    parsed.kind = kindHint;
    parsed.items = [];
    parsed.value ??= parsed.total;
    parsed.unsure = parsed.unsure.filter((u) => u !== 'items' && u !== 'total');
  }
  const { draft, fixed, returnNote } = draftFromReceipt(parsed, text, today, windows());
  draftStore.set({ draft, image, unsure: text.trim() ? parsed.unsure : ['store', 'date', 'total'], source, fixed, returnNote });
}

export function startQuickAdd(sentence: string) {
  const today = todayISO();
  const { draft, fixed } = draftFromQuickAdd(parseQuickAdd(sentence, today), sentence, today, windows());
  const unsure: Array<'store' | 'date' | 'total'> = [];
  if (!draft.store) unsure.push('store');
  if (draft.total === null) unsure.push('total');
  draftStore.set({ draft, image: null, unsure, source: 'quick', fixed, returnNote: null });
}

export function startManual(kind: CardKind = 'purchase') {
  const d = emptyDraft(todayISO(), kind);
  draftStore.set({ draft: kind === 'purchase' ? withSuggestions(d, [], windows()) : d, image: null, unsure: [], source: 'manual', fixed: [], returnNote: null });
}
