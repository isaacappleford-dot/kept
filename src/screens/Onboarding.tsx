import { useState } from 'react';
import { APP } from '../config/app';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui';
import { notificationPermission, requestNotifications } from '../deadlines/notify';
import { isIOS, isStandalone } from '../lib/platform';
import { navigate } from '../lib/router';
import { setSettings } from '../settings';

function Hero() {
  return (
    <svg viewBox="0 0 220 150" className="mx-auto w-64 max-w-full" aria-hidden="true">
      <path d="M24 12h70v122l-11.6-8-11.7 8-11.7-8-11.7 8-11.6-8-11.7 8z" fill="#f4f1ea" />
      <g stroke="#0b0c0c" strokeOpacity="0.28" strokeWidth="5" strokeLinecap="round">
        <path d="M36 34h46M36 50h46M36 66h30M36 90h46" />
      </g>
      <path d="M104 74h20" stroke="#ff5a5f" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 8" />
      <rect x="132" y="30" width="80" height="92" rx="14" fill="#1a1d1c" stroke="rgba(255,255,255,0.15)" />
      <rect x="142" y="42" width="60" height="22" rx="8" fill="#ffa94d" fillOpacity="0.2" />
      <path d="M150 53h28" stroke="#ffa94d" strokeWidth="5" strokeLinecap="round" />
      <rect x="142" y="70" width="60" height="22" rx="8" fill="rgba(255,255,255,0.06)" />
      <path d="M150 81h36" stroke="rgba(255,255,255,0.4)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="198" cy="34" r="12" fill="#ff5a5f" />
      <path d="M192 34l4 4 8-8" stroke="#0b0c0c" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STEPS = ['intro', 'reminders', 'privacy'] as const;

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [asking, setAsking] = useState(false);
  const finish = () => {
    setSettings({ onboarded: true });
    navigate({ name: 'home' }, { replace: true });
  };

  const allowNotifications = async () => {
    setAsking(true);
    const ok = await requestNotifications();
    setSettings({ notifications: ok });
    setAsking(false);
    setStep(2);
  };

  const canNotify = notificationPermission() !== 'unsupported';
  const id = STEPS[step];
  return (
    <main className="h-screen-safe flex flex-col bg-ink px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+24px)]">
      <div className="flex justify-end">
        {step < 2 && (
          <Button variant="ghost" onClick={finish}>
            Skip
          </Button>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center" aria-live="polite">
        {id === 'intro' && (
          <>
            <Hero />
            <h1 className="text-[28px] font-bold leading-tight">Receipts that remind you</h1>
            <p className="max-w-sm text-[16px] text-white/70">
              Snap a receipt once. {APP.name} keeps the return-by date, the warranty and your coupons, and nudges you before money slips away.
            </p>
          </>
        )}
        {id === 'reminders' && (
          <>
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
              <Icon name="bell" size={38} />
            </span>
            <h1 className="text-[28px] font-bold leading-tight">Reminders at the right moment</h1>
            <p className="max-w-sm text-[16px] text-white/70">
              “3 days left to return the boots ($120).” Turn on reminders and they arrive at 9 am on the day, even when the app is closed.
            </p>
            {!canNotify && isIOS && !isStandalone() && (
              <p className="max-w-sm rounded-2xl bg-white/5 p-3 text-[14px] text-white/70">
                On iPhone, notifications work once {APP.name} is on your Home Screen: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.
              </p>
            )}
          </>
        )}
        {id === 'privacy' && (
          <>
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
              <Icon name="shield" size={38} />
            </span>
            <h1 className="text-[28px] font-bold leading-tight">Your receipts stay on your phone</h1>
            <p className="max-w-sm text-[16px] text-white/70">
              Receipts reveal a lot. They’re read and stored on this device only: no account, no uploads, no ads, never sold. Free, with everything unlocked.
            </p>
          </>
        )}
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2" aria-label={`Step ${step + 1} of 3`} role="img">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-accent' : 'w-2 bg-white/25'}`} />
          ))}
        </div>
        {id === 'intro' && (
          <Button className="w-full max-w-xs" onClick={() => setStep(1)}>
            Continue
          </Button>
        )}
        {id === 'reminders' && (
          <>
            {canNotify ? (
              <Button className="w-full max-w-xs" onClick={() => void allowNotifications()} disabled={asking}>
                {asking ? 'Waiting…' : 'Turn on reminders'}
              </Button>
            ) : (
              <Button className="w-full max-w-xs" onClick={() => setStep(2)}>
                Continue
              </Button>
            )}
            {canNotify && (
              <button type="button" className="min-h-[44px] text-[14px] text-white/55" onClick={() => setStep(2)}>
                Not now
              </button>
            )}
          </>
        )}
        {id === 'privacy' && (
          <Button className="w-full max-w-xs" onClick={finish}>
            Get started
          </Button>
        )}
      </div>
    </main>
  );
}
