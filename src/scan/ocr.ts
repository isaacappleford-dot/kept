import { asset } from '../lib/platform';

/**
 * On-device text recognition with Tesseract (WebAssembly). The engine and the
 * English model are served from this site (copied into public/ocr by
 * scripts/copy-assets.mjs), so receipts are never uploaded anywhere.
 */
type TesseractWorker = import('tesseract.js').Worker;

let workerPromise: Promise<TesseractWorker> | null = null;
let progressFn: ((p: number, status: string) => void) | null = null;

function abs(path: string) {
  return new URL(asset(path), location.href).href;
}

export function getOcrWorker(): Promise<TesseractWorker> {
  workerPromise ??= (async () => {
    const { createWorker, OEM } = await import('tesseract.js');
    return createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: abs('ocr/worker.min.js'),
      corePath: abs('ocr/'),
      langPath: abs('ocr/lang'),
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => progressFn?.(m.progress, m.status),
    });
  })().catch((e) => {
    workerPromise = null;
    throw e;
  });
  return workerPromise;
}

/** Starts loading the engine in the background (e.g. when the Scan screen opens). */
export function warmUpOcr() {
  void getOcrWorker().catch(() => {});
}

export async function recognise(image: HTMLCanvasElement, onProgress?: (p: number, status: string) => void): Promise<string> {
  progressFn = onProgress ?? null;
  try {
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(image);
    return data.text ?? '';
  } finally {
    progressFn = null;
  }
}
