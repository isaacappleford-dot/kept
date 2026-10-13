import { APP } from './config/app';
import type { MembershipId } from './config/policies';
import type { SuggestPrefs } from './deadlines/policy';
import { load, save } from './lib/storage';
import { createStore, useStore } from './lib/store';

export interface Settings {
  onboarded: boolean;
  currency: string;
  /** Show notifications for due reminders when the app is opened (where allowed). */
  notifications: boolean;
  /** Show the number of deadlines this week on the app icon (where supported). */
  badge: boolean;
  /** Read receipt text on the phone after each scan. */
  autoRead: boolean;
  /** When the last backup file was saved. */
  lastBackupAt: number;
  /** When the occasional "back up?" popup was last shown. */
  backupReminderDismissedAt: number;
  /** Weekly Sunday check-in notification. */
  checkin: boolean;
  /** When the user last finished the check-in screen. */
  lastCheckinAt: number;
  /** No return/warranty reminders for purchases under this many cents (0 = remind for everything). */
  minReminderAmount: number;
  /** Return windows the user set for a store, in days (see deadlines/policy.ts storeKey). */
  storeWindows: Record<string, number>;
  /** Store cards / memberships that lengthen return windows. */
  memberships: MembershipId[];
  /** Months the user's credit card adds to manufacturer warranties (0 = none). */
  cardWarrantyMonths: number;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  currency: APP.currency,
  notifications: false,
  badge: true,
  autoRead: true,
  lastBackupAt: 0,
  backupReminderDismissedAt: 0,
  checkin: true,
  lastCheckinAt: 0,
  minReminderAmount: 2000,
  storeWindows: {},
  memberships: [],
  cardWarrantyMonths: 0,
};

export const settingsStore = createStore<Settings>(load('settings', DEFAULT_SETTINGS), (s) => save('settings', s));

export const useSettings = () => useStore(settingsStore);
export const setSettings = settingsStore.set;

/** The parts of Settings that change suggested dates. */
export function suggestPrefs(s: Settings = settingsStore.get()): SuggestPrefs {
  return { windows: s.storeWindows, memberships: s.memberships, cardWarrantyMonths: s.cardWarrantyMonths };
}
