// Rasterises src/assets/logo.svg into every icon size the PWA needs.
// Run with `npm run icons` after changing the logo; outputs are committed.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/icons');
await mkdir(out, { recursive: true });
const svg = await readFile(join(root, 'src/assets/logo.svg'), 'utf8');

// "any" icons keep the rounded square; maskable/apple icons are full-bleed with
// the artwork inside the 80% safe zone.
const fullBleed = svg
  .replace('rx="112"', 'rx="0"')
  .replace('<g ', '<g transform="translate(51.2 51.2) scale(0.8)" ')
  .replace('<circle ', '<circle transform="translate(51.2 51.2) scale(0.8)" ')
  .replace('<path d="M318', '<path transform="translate(51.2 51.2) scale(0.8)" d="M318');

const jobs = [
  ['icon-192.png', svg, 192],
  ['icon-512.png', svg, 512],
  ['favicon-32.png', svg, 32],
  ['maskable-192.png', fullBleed, 192],
  ['maskable-512.png', fullBleed, 512],
  ['apple-touch-icon.png', fullBleed, 180],
];
for (const [name, src, size] of jobs) {
  await sharp(Buffer.from(src), { density: 384 }).resize(size, size).png().toFile(join(out, name));
}
await writeFile(join(out, 'logo.svg'), svg);
console.log('Icons written to public/icons');
