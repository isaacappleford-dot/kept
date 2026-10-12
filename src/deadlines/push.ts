import { listCards, onDataChange } from '../data/db';
import { todayISO } from '../lib/dates';
import { settingsStore } from '../settings';
import { deadlines } from './deadlines';
import { scheduleReminders } from './schedule';

/**
 * Reminders while the app is closed, through the free Kept reminders server
 * (server/). Each phone subscribes with its own push address and sends only its
 * own upcoming reminders; the server delivers them at the right time.
 * Without VITE_PUSH_URL at build time, Kept falls back to on-open notifications.
 */
const SERVER = (import.meta.env.VITE_PUSH_URL ?? '').replace(/\/$/, '');

export function pushConfigured(): boolean {
  return !!SERVER;
}

export function pushSupported(): boolean {
  return pushConfigured() && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ?? (await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 8000))]));
  } catch {
    return null;
  }
}

function keyBytes(b64: string): Uint8Array {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return (await reg?.pushManager.getSubscription().catch(() => null)) ?? null;
}

/** Asks for permission (must be called from a tap) and subscribes this phone. */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    if ((await Notification.requestPermission()) !== 'granted') return false;
    const reg = await registration();
    if (!reg) return false;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = (await (await fetch(`${SERVER}/vapid`)).json()) as { publicKey: string };
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource });
    }
    await syncPush(sub);
    return true;
  } catch (e) {
    console.warn('Push setup failed', e);
    return false;
  }
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch(`${SERVER}/unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Sends this phone's upcoming reminders to the server (replacing the old list). */
export async function syncPush(sub?: PushSubscription | null): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const subscription = sub ?? (await currentSubscription());
  if (!subscription) return false;
  const s = settingsStore.get();
  const today = todayISO();
  const base = new URL(import.meta.env.BASE_URL, location.href).href;
  const reminders = scheduleReminders(deadlines(await listCards(), today), today, Date.now(), s.currency, (id) => `${base}#/card/${encodeURIComponent(id)}`);
  try {
    const res = await fetch(`${SERVER}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON(), reminders }),
    });
    return res.ok;
  } catch {
    return false; // offline: we'll sync next time
  }
}

/** True when the server is delivering this phone's reminders. */
export async function pushActive(): Promise<boolean> {
  return pushSupported() && settingsStore.get().notifications && Notification.permission === 'granted' && !!(await currentSubscription());
}

let timer = 0;
/** Keeps the server's copy up to date as cards change, and once per app open. */
export function startPushSync() {
  if (!pushSupported()) return;
  const later = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (settingsStore.get().notifications) void syncPush();
    }, 1500);
  };
  onDataChange(later);
  settingsStore.subscribe(later); // currency changes the message text
  later();
}
