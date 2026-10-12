import { listCards } from '../data/db';
import { loadValue, save } from '../lib/storage';
import { todayISO } from '../lib/dates';
import { settingsStore } from '../settings';
import { deadlines } from './deadlines';
import { dueReminders } from './reminders';

/**
 * Reminders on the web. A web app can't wake itself up while closed, so:
 *  - Coming Up is the source of truth whenever the app is opened;
 *  - due reminders are shown as notifications when the app opens or comes back
 *    to the foreground (iPhone: only when installed to the Home Screen, iOS 16.4+);
 *  - the app icon shows a badge with this week's count (where supported);
 *  - "Add to Calendar" hands deadlines to the phone's calendar, which alerts
 *    even when the app is closed.
 */

const FIRED_KEY = 'fired-reminders';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

async function show(title: string, body: string, tag: string, cardId: string) {
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined);
  const options: NotificationOptions = {
    body,
    tag,
    icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
    badge: `${import.meta.env.BASE_URL}icons/favicon-32.png`,
    data: { url: `${import.meta.env.BASE_URL}#/card/${encodeURIComponent(cardId)}` },
  };
  if (reg?.showNotification) await reg.showNotification(title, options);
  else new Notification(title, options);
}

let running = false;

/** Checks for due reminders and updates the badge. Safe to call often. */
export async function checkReminders() {
  if (running) return;
  running = true;
  try {
    const s = settingsStore.get();
    const today = todayISO();
    const list = deadlines(await listCards(), today);

    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    const urgent = list.filter((d) => d.urgency === 'week').length;
    if (s.badge && nav.setAppBadge) await (urgent ? nav.setAppBadge(urgent) : nav.clearAppBadge?.())?.catch(() => {});
    else if (!s.badge) await nav.clearAppBadge?.().catch(() => {});

    if (!s.notifications || notificationPermission() !== 'granted') return;
    const fired = new Set(loadValue<string[]>(FIRED_KEY, []));
    const due = dueReminders(list, fired, today, s.currency);
    for (const r of due.slice(0, 5)) {
      await show(r.title, r.body, `${r.deadline.cardId}:${r.deadline.kind}`, r.deadline.cardId).catch(() => {});
      fired.add(r.key);
    }
    // Keep the list bounded: drop keys for deadlines long gone.
    save(FIRED_KEY, [...fired].slice(-500));
  } finally {
    running = false;
  }
}

export function startReminderChecks() {
  void checkReminders();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkReminders();
  });
  // A Home Screen app can stay open across midnight.
  setInterval(() => void checkReminders(), 60 * 60 * 1000);
}
