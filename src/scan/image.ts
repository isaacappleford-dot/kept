import { applyLevels, fitWithin, stretchLevels, toGray } from './pixels';

/** Largest side we keep for the saved receipt photo, and for OCR. */
const SAVE_MAX = 1800;
const THUMB_MAX = 320;
const OCR_MAX = 2200;

type Source = ImageBitmap | HTMLImageElement | HTMLCanvasElement;
const sizeOf = (s: Source) => ('naturalWidth' in s ? { w: s.naturalWidth, h: s.naturalHeight } : { w: s.width, h: s.height });

/** Decodes a photo upright (EXIF orientation applied), including HEIC where the browser supports it. */
export async function decodeImage(file: Blob): Promise<Source> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall back to <img> (older Safari) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function draw(src: Source, max: number): HTMLCanvasElement {
  const { w, h } = sizeOf(src);
  const size = fitWithin(w, h, max);
  const c = document.createElement('canvas');
  c.width = size.w;
  c.height = size.h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, size.w, size.h);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/jpeg', quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality));
}

/** Releases canvas memory right away (matters on iPhone). */
export function release(c: HTMLCanvasElement) {
  c.width = c.height = 0;
}

export interface PreparedImage {
  image: Blob;
  thumb: Blob;
  /** High-contrast grey version for the text recogniser. */
  ocr: HTMLCanvasElement;
}

export async function prepareImage(src: Source): Promise<PreparedImage> {
  const save = draw(src, SAVE_MAX);
  const thumbC = draw(save, THUMB_MAX);
  const [image, thumb] = await Promise.all([canvasToBlob(save, 'image/jpeg', 0.8), canvasToBlob(thumbC, 'image/jpeg', 0.75)]);
  release(save);
  release(thumbC);

  const ocr = draw(src, OCR_MAX);
  const ctx = ocr.getContext('2d', { willReadFrequently: true })!;
  const px = ctx.getImageData(0, 0, ocr.width, ocr.height);
  const [lo, hi] = stretchLevels(toGray(px.data));
  applyLevels(px.data, lo, hi);
  ctx.putImageData(px, 0, 0);
  if ('close' in src && typeof src.close === 'function') src.close();
  return { image, thumb, ocr };
}

/** A photo or screenshot shrunk to a JPEG of at most `max` px on the long side (return labels, coupons). */
export async function shrinkImage(file: Blob, max = 1600): Promise<Blob> {
  const src = await decodeImage(file);
  const c = draw(src, max);
  const out = await canvasToBlob(c, 'image/jpeg', 0.85);
  release(c);
  if ('close' in src && typeof src.close === 'function') src.close();
  return out;
}
