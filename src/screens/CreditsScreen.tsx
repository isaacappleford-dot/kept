import { Header } from '../components/ui';
import { back } from '../lib/router';

const CREDITS: Array<[string, string, string]> = [
  ['Tesseract.js', 'Apache-2.0', 'On-device text recognition (WebAssembly build of Tesseract OCR).'],
  ['Tesseract OCR & English model', 'Apache-2.0', 'The recognition engine and trained language data.'],
  ['pdf.js', 'Apache-2.0', 'Reading text from PDF receipts.'],
  ['Dexie.js', 'Apache-2.0', 'IndexedDB storage.'],
  ['React', 'MIT', 'User interface.'],
  ['Workbox', 'MIT', 'Offline support.'],
];

export default function CreditsScreen() {
  return (
    <div className="min-h-screen-safe bg-ink pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <Header title="Credits & licenses" onBack={() => back({ name: 'settings' })} />
      <ul className="mx-auto max-w-lg divide-y divide-white/10 px-5">
        {CREDITS.map(([name, license, what]) => (
          <li key={name} className="py-3">
            <p className="text-[16px] font-medium">
              {name} <span className="text-[13px] text-white/45">· {license}</span>
            </p>
            <p className="text-[14px] text-white/60">{what}</p>
          </li>
        ))}
      </ul>
      <p className="mx-auto max-w-lg px-5 pt-4 text-[13px] text-white/45">
        Store return windows and warranty lengths are typical values used as suggestions only. Always check the receipt or the store’s current policy.
      </p>
    </div>
  );
}
