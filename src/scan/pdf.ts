import { canvasToBlob, release } from './image';
import { fitWithin } from './pixels';

/**
 * Online order receipts saved as PDF: read the text layer directly (exact, no
 * OCR needed) and render page 1 as the receipt photo. pdf.js is loaded only
 * when a PDF is picked.
 */
export async function readPdf(file: Blob): Promise<{ text: string; image: Blob | null; thumb: Blob | null }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableFontFace: true });
  const doc = await task.promise;
  try {
    const lines: string[] = [];
    for (let p = 1; p <= Math.min(doc.numPages, 4); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // Group text runs into lines by their baseline.
      const rows = new Map<number, Array<{ x: number; s: string }>>();
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = Math.round(item.transform[5] / 3);
        const row = rows.get(y) ?? [];
        row.push({ x: item.transform[4], s: item.str });
        rows.set(y, row);
      }
      [...rows.entries()]
        .sort((a, b) => b[0] - a[0])
        .forEach(([, row]) => lines.push(row.sort((a, b) => a.x - b.x).map((r) => r.s.trim()).join('  ')));
    }

    const page = await doc.getPage(1);
    const vp1 = page.getViewport({ scale: 1 });
    const target = fitWithin(vp1.width * 3, vp1.height * 3, 1800);
    const viewport = page.getViewport({ scale: target.w / vp1.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const image = await canvasToBlob(canvas, 'image/jpeg', 0.82);
    const t = document.createElement('canvas');
    const ts = fitWithin(canvas.width, canvas.height, 320);
    t.width = ts.w;
    t.height = ts.h;
    t.getContext('2d')!.drawImage(canvas, 0, 0, ts.w, ts.h);
    const thumb = await canvasToBlob(t, 'image/jpeg', 0.75);
    release(canvas);
    release(t);
    return { text: lines.join('\n'), image, thumb };
  } finally {
    void task.destroy();
  }
}
