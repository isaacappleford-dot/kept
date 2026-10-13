import { APP } from '../config/app';
import { categoryById } from '../config/policies';
import { getImage } from '../data/db';
import { cardName, KIND_LABEL, nextCharge, type Card } from '../data/types';
import { formatLong, todayISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { decodeImage, canvasToBlob, release } from '../scan/image';
import { fitWithin } from '../scan/pixels';
import { buildPdf, LETTER, textWidth, wrapText, type PdfOp, type PdfPage } from './pdfWriter';

const M = 48; // page margin
const GREY: [number, number, number] = [0.42, 0.42, 0.42];

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'receipt'
  );
}

export function fileName(card: Pick<Card, 'store' | 'title' | 'date'>, ext: string): string {
  return `${APP.filePrefix}-${slug(card.store || card.title)}-${card.date}.${ext}`;
}

/** Re-encodes as baseline RGB JPEG (what the PDF needs) and returns its bytes and size. */
async function jpegFor(blob: Blob, max = 1600): Promise<{ bytes: Uint8Array; w: number; h: number } | null> {
  try {
    const src = await decodeImage(blob);
    const sw = 'naturalWidth' in src ? src.naturalWidth : src.width;
    const sh = 'naturalHeight' in src ? src.naturalHeight : src.height;
    const size = fitWithin(sw, sh, max);
    const c = document.createElement('canvas');
    c.width = size.w;
    c.height = size.h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0, size.w, size.h);
    const out = await canvasToBlob(c, 'image/jpeg', 0.85);
    release(c);
    return { bytes: new Uint8Array(await out.arrayBuffer()), w: size.w, h: size.h };
  } catch {
    return null;
  }
}

/** One receipt as a PDF: details on page 1, the receipt photo on page 2. For warranty claims and expense reports. */
export async function receiptPdf(card: Card, currency: string): Promise<File> {
  const ops: PdfOp[] = [];
  let y = M + 10;
  const text = (s: string, size = 11, bold = false, color?: [number, number, number]) => {
    for (const line of wrapText(s, size, LETTER.w - 2 * M, bold)) {
      ops.push({ t: 'text', x: M, y, size, text: line, bold, color });
      y += size * 1.4;
    }
  };
  const row = (label: string, value: string) => {
    if (!value) return;
    ops.push({ t: 'text', x: M, y, size: 10, text: label, color: GREY });
    ops.push({ t: 'text', x: M + 150, y, size: 11, text: value });
    y += 18;
  };

  text(cardName(card), 22, true);
  text(`${card.store || KIND_LABEL[card.kind]} · ${formatLong(card.date)}`, 12, false, GREY);
  y += 8;
  ops.push({ t: 'line', x1: M, y1: y, x2: LETTER.w - M, y2: y });
  y += 22;

  row('Type', KIND_LABEL[card.kind]);
  row('Store', card.store);
  row(card.kind === 'purchase' ? 'Purchase date' : 'Issued', formatLong(card.date));
  if (card.kind === 'purchase') {
    row('Total', formatMoney(card.total, currency));
    row('Category', categoryById(card.category).label);
    if (card.online && card.deliveryDate) row('Delivered', formatLong(card.deliveryDate));
    if (card.returnBy) row('Return by', formatLong(card.returnBy));
    if (card.warrantyUntil) row('Warranty until', formatLong(card.warrantyUntil));
    if (card.extendedWarrantyUntil) row('Extended warranty', formatLong(card.extendedWarrantyUntil));
  } else if (card.kind === 'renewal') {
    row('Amount', formatMoney(card.total, currency));
    const next = nextCharge(card, todayISO());
    if (next) row('Charges on', formatLong(next));
    row('Repeats', { none: 'Once', monthly: 'Monthly', yearly: 'Yearly' }[card.repeat]);
  } else {
    row('Balance', formatMoney(card.balance, currency));
    row('Code', card.code);
    if (card.expires) row('Expires', formatLong(card.expires));
  }
  row('Serial number', card.serial);
  row('Gift for', card.giftFor);

  if (card.items.length) {
    y += 10;
    text('Items', 13, true);
    y += 2;
    for (const it of card.items) {
      const price = it.price !== null ? formatMoney(it.price, currency) : '';
      ops.push({ t: 'text', x: M, y, size: 11, text: it.name.slice(0, 70) });
      if (price) ops.push({ t: 'text', x: LETTER.w - M - textWidth(price, 11), y, size: 11, text: price });
      y += 17;
      if (y > LETTER.h - M) break;
    }
  }
  if (card.notes && y < LETTER.h - M - 60) {
    y += 10;
    text('Notes', 13, true);
    text(card.notes, 11);
  }
  ops.push({ t: 'text', x: M, y: LETTER.h - M / 2, size: 8, text: `Exported from ${APP.name} on ${formatLong(new Date().toISOString().slice(0, 10))}`, color: GREY });

  const pages: PdfPage[] = [{ ops }];
  const img = card.hasImage ? await getImage(card.id) : undefined;
  const jpeg = img ? await jpegFor(img.image) : null;
  if (jpeg) {
    const box = { w: LETTER.w - 2 * M, h: LETTER.h - 2 * M };
    const s = Math.min(box.w / jpeg.w, box.h / jpeg.h);
    const w = jpeg.w * s;
    const h = jpeg.h * s;
    pages.push({ ops: [{ t: 'image', x: (LETTER.w - w) / 2, y: M, w, h, jpeg: jpeg.bytes, pxW: jpeg.w, pxH: jpeg.h }] });
  }
  const bytes = buildPdf(pages, LETTER, `${cardName(card)} receipt`);
  return new File([bytes as BlobPart], fileName(card, 'pdf'), { type: 'application/pdf' });
}

/** "Everything I own" with prices, for insurance claims. */
export function inventoryPdf(cards: Card[], currency: string): File {
  const owned = cards.filter((c) => c.kind === 'purchase' && c.returnStatus !== 'returned').sort((a, b) => a.date.localeCompare(b.date));
  const pages: PdfPage[] = [];
  let ops: PdfOp[] = [];
  let y = 0;
  const cols = [M, M + 200, M + 320, M + 400];
  const header = () => {
    ops = [];
    pages.push({ ops });
    y = M + 10;
    if (pages.length === 1) {
      ops.push({ t: 'text', x: M, y, size: 20, text: 'Home inventory', bold: true });
      y += 22;
      const total = owned.reduce((s, c) => s + (c.total ?? 0), 0);
      ops.push({ t: 'text', x: M, y, size: 11, text: `${owned.length} items · ${formatMoney(total, currency)} · ${formatLong(new Date().toISOString().slice(0, 10))}`, color: GREY });
      y += 26;
    }
    ['Item', 'Store', 'Purchased', 'Serial / notes'].forEach((h, i) => ops.push({ t: 'text', x: cols[i], y, size: 9, text: h.toUpperCase(), bold: true, color: GREY }));
    ops.push({ t: 'text', x: LETTER.w - M - textWidth('PRICE', 9, true), y, size: 9, text: 'PRICE', bold: true, color: GREY });
    y += 8;
    ops.push({ t: 'line', x1: M, y1: y, x2: LETTER.w - M, y2: y });
    y += 16;
  };
  header();
  const clip = (s: string, w: number, size = 10) => {
    let out = s;
    while (out.length > 1 && textWidth(out, size) > w) out = out.slice(0, -1);
    return out === s ? s : `${out.slice(0, -1)}…`;
  };
  for (const c of owned) {
    if (y > LETTER.h - M) header();
    ops.push({ t: 'text', x: cols[0], y, size: 10, text: clip(cardName(c), 190) });
    ops.push({ t: 'text', x: cols[1], y, size: 10, text: clip(c.store, 110) });
    ops.push({ t: 'text', x: cols[2], y, size: 10, text: c.date });
    ops.push({ t: 'text', x: cols[3], y, size: 9, text: clip(c.serial || c.notes, 100, 9), color: GREY });
    const price = formatMoney(c.total, currency);
    if (price) ops.push({ t: 'text', x: LETTER.w - M - textWidth(price, 10), y, size: 10, text: price });
    y += 18;
  }
  const bytes = buildPdf(pages, LETTER, 'Home inventory');
  return new File([bytes as BlobPart], `${APP.filePrefix}-inventory-${new Date().toISOString().slice(0, 10)}.pdf`, { type: 'application/pdf' });
}
