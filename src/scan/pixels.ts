/**
 * Pure pixel helpers for OCR prep (unit-tested). Receipts are low-contrast
 * thermal paper: converting to grey and stretching the histogram helps the
 * text recogniser a lot.
 */

/** RGBA → luma in place (R=G=B), returning a histogram of 256 bins. */
export function toGray(data: Uint8ClampedArray): Uint32Array {
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const y = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    data[i] = data[i + 1] = data[i + 2] = y;
    hist[y]++;
  }
  return hist;
}

/** Levels that clip `clip` of pixels at each end. */
export function stretchLevels(hist: Uint32Array, clip = 0.01): [number, number] {
  let total = 0;
  for (const v of hist) total += v;
  const cut = total * clip;
  let lo = 0;
  let acc = 0;
  while (lo < 255 && acc + hist[lo] <= cut) acc += hist[lo++];
  let hi = 255;
  acc = 0;
  while (hi > 0 && acc + hist[hi] <= cut) acc += hist[hi--];
  if (hi - lo < 16) return [0, 255]; // flat image: leave it alone
  return [lo, hi];
}

/** Applies a linear stretch from [lo, hi] to [0, 255] on grey RGBA data. */
export function applyLevels(data: Uint8ClampedArray, lo: number, hi: number) {
  const lut = new Uint8ClampedArray(256);
  const scale = 255 / Math.max(1, hi - lo);
  for (let v = 0; v < 256; v++) lut[v] = (v - lo) * scale;
  for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = lut[data[i]];
}

/** Size that fits within `max` on the long side, never upscaling. */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}
