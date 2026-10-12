import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { Button, Header } from '../components/ui';
import type { CardKind } from '../data/types';
import { back, navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { warmUpOcr } from '../scan/ocr';
import { processFile, processSample, startManual, startQuickAdd } from '../scan/pipeline';
import { useSettings } from '../settings';

function BigOption({ icon, title, hint, onClick, primary }: { icon: IconName; title: string; hint: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        primary ? 'bg-accent text-ink active:bg-accent-soft' : 'bg-white/5 active:bg-white/10'
      }`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${primary ? 'bg-ink/10' : 'bg-white/10'}`}>
        <Icon name={icon} size={26} />
      </span>
      <span className="flex-1">
        <span className="block text-[17px] font-semibold">{title}</span>
        <span className={`block text-[13px] ${primary ? 'text-ink/70' : 'text-white/55'}`}>{hint}</span>
      </span>
    </button>
  );
}

export default function ScanScreen() {
  const settings = useSettings();
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const kindHint = useRef<CardKind>('purchase');
  const [busy, setBusy] = useState<{ p: number; label: string } | null>(null);
  const [sentence, setSentence] = useState('');

  useEffect(() => {
    // Start loading the text reader while the user lines up the shot.
    if (settings.autoRead) {
      const t = window.setTimeout(warmUpOcr, 400);
      return () => clearTimeout(t);
    }
  }, [settings.autoRead]);

  const run = async (job: () => Promise<void>) => {
    setBusy({ p: 0, label: 'Preparing' });
    try {
      await job();
      navigate({ name: 'review' }, { replace: true });
    } catch (e) {
      console.error(e);
      toast('Couldn’t read that file. Try a photo or enter it by hand.');
    } finally {
      setBusy(null);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void run(() => processFile(file, { kindHint: kindHint.current, read: settings.autoRead, onProgress: (p, label) => setBusy({ p, label }) }));
  };

  const pick = (input: 'camera' | 'library', kind: CardKind = 'purchase') => {
    kindHint.current = kind;
    (input === 'camera' ? camera : library).current?.click();
  };

  return (
    <div className="min-h-screen-safe bg-ink pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <Header title="Add" onBack={() => back({ name: 'home' })} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} aria-hidden="true" tabIndex={-1} />
      <input ref={library} type="file" accept="image/*,application/pdf,.pdf,.heic,.heif" className="hidden" onChange={onFile} data-testid="file-input" aria-hidden="true" tabIndex={-1} />

      <div className="mx-auto max-w-lg space-y-3 px-3">
        <BigOption primary icon="camera" title="Scan a receipt" hint="Flat, in good light, edges in view" onClick={() => pick('camera')} />
        <BigOption icon="image" title="Screenshot, photo or PDF" hint="Online order emails: screenshot or save as PDF" onClick={() => pick('library')} />
        <BigOption icon="tag" title="Coupon, gift card or store credit" hint="Scan it to keep it in your Wallet" onClick={() => pick('camera', 'coupon')} />

        <form
          className="rounded-2xl bg-white/5 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!sentence.trim()) return;
            startQuickAdd(sentence);
            setSentence('');
            navigate({ name: 'review' }, { replace: true });
          }}
        >
          <label htmlFor="quick-add" className="flex items-center gap-2 text-[17px] font-semibold">
            <Icon name="mic" size={20} /> Quick add
          </label>
          <p className="mb-2 mt-0.5 text-[13px] text-white/55">No receipt handy? Type it, or tap the mic on your keyboard and say it.</p>
          <textarea
            id="quick-add"
            rows={2}
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Got a vacuum at Target, 90-day return"
            enterKeyHint="done"
            className="block w-full resize-none rounded-xl bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:outline focus:outline-2 focus:outline-accent"
          />
          <Button type="submit" disabled={!sentence.trim()} className="mt-3 w-full">
            Add
          </Button>
        </form>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              startManual('purchase');
              navigate({ name: 'review' }, { replace: true });
            }}
          >
            <Icon name="edit" size={18} /> Type it in
          </Button>
          <Button variant="secondary" onClick={() => void run(() => processSample((p, label) => setBusy({ p, label })))}>
            <Icon name="sparkle" size={18} /> Sample receipt
          </Button>
        </div>
        <p className="px-2 pt-2 text-center text-[12px] text-white/40">
          <Icon name="lock" size={12} className="inline align-[-1px]" /> Receipts are read on this phone. Nothing is uploaded.
        </p>
      </div>

      {busy && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-ink/95 px-10 text-center" role="status" aria-live="polite">
          <div className="relative h-40 w-28 overflow-hidden rounded-lg bg-paper/90">
            <div className="absolute inset-x-3 top-4 space-y-2">
              {[70, 50, 80, 60, 75, 40, 65].map((w, i) => (
                <div key={i} className="h-1.5 rounded bg-ink/25" style={{ width: `${w}%` }} />
              ))}
            </div>
            <div className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-accent/50 to-transparent motion-safe:animate-[sweep_1.4s_ease-in-out_infinite_alternate]" />
          </div>
          <p className="text-[17px] font-semibold">{busy.label}…</p>
          <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(busy.p * 100)}%` }} />
          </div>
          <p className="text-[13px] text-white/50">This happens on your phone. The first scan takes a little longer.</p>
        </div>
      )}
    </div>
  );
}
