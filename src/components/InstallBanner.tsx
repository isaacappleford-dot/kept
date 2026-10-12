import { useState } from 'react';
import { APP } from '../config/app';
import { dismissInstall, installDismissed, useInstall } from '../pwa/install';
import { Icon } from './Icon';

/** Android: native install prompt. iPhone: how to Add to Home Screen. Dismissible. */
export function InstallBanner() {
  const install = useInstall();
  const [hidden, setHidden] = useState(installDismissed());
  if (!install.mode || hidden) return null;
  const close = () => {
    dismissInstall();
    setHidden(true);
  };
  return (
    <div className="mx-3 mb-3 flex items-center gap-3 rounded-2xl bg-white/5 p-3 text-[13px] text-white/85" role="note">
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="h-10 w-10 rounded-xl" />
      <div className="flex-1">
        <p className="font-semibold text-white">Install {APP.name}</p>
        {install.mode === 'ios' ? (
          <p>
            Tap <Icon name="share" size={14} className="inline align-[-2px]" /> Share, then “Add to Home Screen”. Works offline, full screen.
          </p>
        ) : (
          <p>Full screen, works offline, one tap from your home screen.</p>
        )}
      </div>
      {install.mode === 'android' && (
        <button type="button" className="min-h-[40px] rounded-full bg-accent px-3 font-semibold text-ink" onClick={() => void install.prompt().then(close)}>
          Install
        </button>
      )}
      <button type="button" aria-label="Dismiss" className="-m-1 flex h-11 w-11 items-center justify-center" onClick={close}>
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
