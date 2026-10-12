/** What the app sends the reminders server. Shared by both sides. */

export interface ScheduledReminder {
  /** Unique per deadline and stage; the server never sends the same key twice to one phone. */
  key: string;
  /** When to deliver (epoch ms, already in the person's local time). */
  fireAt: number;
  title: string;
  body: string;
  /** Opened when the notification is tapped. */
  url: string;
}

export interface SyncRequest {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  reminders: ScheduledReminder[];
}

export const MAX_REMINDERS = 300;
const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

/** Returns an error message, or null when the request is well-formed. */
export function validateSync(x: unknown, opts: { allowLocalEndpoints?: boolean } = {}): string | null {
  if (!x || typeof x !== 'object') return 'Expected JSON';
  const { subscription: s, reminders } = x as Partial<SyncRequest>;
  const local = opts.allowLocalEndpoints && typeof s?.endpoint === 'string' && /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(s.endpoint);
  if (!s || !str(s.endpoint, 1000) || !(/^https:\/\//.test(s.endpoint) || local)) return 'Bad subscription endpoint';
  if (!s.keys || !str(s.keys.p256dh, 200) || !str(s.keys.auth, 100)) return 'Bad subscription keys';
  if (!Array.isArray(reminders) || reminders.length > MAX_REMINDERS) return 'Bad reminders';
  for (const r of reminders) {
    if (!r || !str(r.key, 200) || !str(r.title, 200) || typeof r.body !== 'string' || r.body.length > 500 || !str(r.url, 500)) return 'Bad reminder';
    if (typeof r.fireAt !== 'number' || !Number.isFinite(r.fireAt)) return 'Bad reminder time';
  }
  return null;
}
