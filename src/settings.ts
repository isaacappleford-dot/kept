import { APP } from './config/app';
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
  backupReminderDismissedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  currency: APP.currency,
  notifications: false,
  badge: true,
  autoRead: true,
  lastBackupAt: 0,
  backupReminderDismissedAt: 0,
};

export const settingsStore = createStore<Settings>(load('settings', DEFAULT_SETTINGS), (s) => save('settings', s));

export const useSettings = () => useStore(settingsStore);
export const setSettings = settingsStore.set;
