import { addDays, parts, type ISODate } from '../lib/dates';

/**
 * Draws a realistic thermal-paper receipt on a canvas, dated a few days ago,
 * so the whole scan → read → review flow can be tried without a receipt (and
 * is exercised by the end-to-end test).
 */
export function drawSampleReceipt(today: ISODate): HTMLCanvasElement {
  const date = addDays(today, -4);
  const [y, m, d] = parts(date);
  const lines: Array<[string, string?] | null> = [
    ['TARGET'],
    ['1234 MAIN STREET'],
    ['SPRINGFIELD IL 62701'],
    null,
    [`${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y} 14:32`],
    null,
    ['SONY WIRELESS HEADPHONES', '99.99'],
    ['THROW PILLOW', '24.99'],
    null,
    ['SUBTOTAL', '124.98'],
    ['TAX', '10.94'],
    ['TOTAL', '135.92'],
    ['VISA CHARGE', '135.92'],
    null,
    ['RETURNS WITHIN 90 DAYS'],
    ['THANK YOU'],
  ];
  const W = 900;
  const lh = 64;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = 120 + lines.length * lh;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fbfaf6';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#1b1b1b';
  ctx.textBaseline = 'alphabetic';
  lines.forEach((line, i) => {
    if (!line) return;
    const yy = 100 + i * lh;
    if (i === 0) {
      ctx.font = 'bold 64px "Courier New", Courier, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(line[0], W / 2, yy);
      return;
    }
    ctx.font = 'bold 40px "Courier New", Courier, monospace';
    if (line[1] === undefined) {
      ctx.textAlign = 'center';
      ctx.fillText(line[0], W / 2, yy);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(line[0], 50, yy);
      ctx.textAlign = 'right';
      ctx.fillText(line[1], W - 50, yy);
    }
  });
  return c;
}
