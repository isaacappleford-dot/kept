/**
 * App identity. Rename the app here — the UI, the HTML <title> and the PWA
 * manifest all read from this file.
 */
export const APP = {
  name: 'Kept',
  shortName: 'Kept',
  tagline: 'Receipts that remind you.',
  description:
    'A free app that turns receipts into reminders. Snap a receipt once and never miss a return window, warranty or coupon again. Everything stays on your phone.',
  /** Background of the UI; also the PWA theme/background colour. */
  themeColor: '#0b0c0c',
  backgroundColor: '#0b0c0c',
  /** Prefix for localStorage keys and the IndexedDB name. */
  storagePrefix: 'kept',
  /** File name prefix for exports, e.g. kept-target-2026-10-11.pdf */
  filePrefix: 'kept',
  /** Default currency for new installs (changeable in Settings). */
  currency: 'USD',
} as const;
