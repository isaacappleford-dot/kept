// Copies the on-device OCR engine (Tesseract.js worker + WASM cores) and the
// English model from node_modules into public/ocr, so the app never loads them
// from a CDN. Runs before `dev` and `build`.
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));
const out = join(root, 'public/ocr');

const jobs = [
  [join(pkgDir('tesseract.js'), 'dist/worker.min.js'), join(out, 'worker.min.js')],
  // LSTM-only cores (smaller, and the only engine the "best_int" model needs).
  ...['tesseract-core-lstm', 'tesseract-core-simd-lstm', 'tesseract-core-relaxedsimd-lstm'].map((n) => [
    join(pkgDir('tesseract.js-core'), `${n}.wasm.js`),
    join(out, `${n}.wasm.js`),
  ]),
  [join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int/eng.traineddata.gz'), join(out, 'lang/eng.traineddata.gz')],
];

await mkdir(join(out, 'lang'), { recursive: true });
for (const [from, to] of jobs) {
  const [a, b] = await Promise.all([stat(from), stat(to).catch(() => null)]);
  if (b && b.size === a.size && b.mtimeMs >= a.mtimeMs) continue;
  await copyFile(from, to);
}
console.log('OCR assets ready in public/ocr');
