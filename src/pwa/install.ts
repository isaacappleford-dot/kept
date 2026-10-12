import { useEffect, useState } from 'react';
import { isIOS, isStandalone } from '../lib/platform';
import { loadValue, save } from '../lib/storage';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const subs = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    subs.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    subs.forEach((f) => f());
  });
}

export type InstallMode = 'android' | 'ios' | null;

/** Which install help to offer: the native prompt (Android/desktop Chrome) or the iOS how-to. */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  const standalone = isStandalone();
  const mode: InstallMode = standalone ? null : deferred ? 'android' : isIOS ? 'ios' : null;
  return {
    mode,
    async prompt() {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      subs.forEach((f) => f());
      return outcome === 'accepted';
    },
  };
}

const KEY = 'install-dismissed';
export const installDismissed = () => loadValue<number>(KEY, 0) > Date.now() - 1000 * 60 * 60 * 24 * 14;
export const dismissInstall = () => save(KEY, Date.now());
