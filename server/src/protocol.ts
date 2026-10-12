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
export const MAX_TITLE = 200;
export const MAX_BODY = 500;
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
    if (!r || !str(r.key, 200) || !str(r.title, MAX_TITLE) || typeof r.body !== 'string' || r.body.length > MAX_BODY || !str(r.url, 500)) return 'Bad reminder';
    if (typeof r.fireAt !== 'number' || !Number.isFinite(r.fireAt)) return 'Bad reminder time';
  }
  return null;
}

/** Keys of weekly check-in reminders start with this. */
export const DIGEST_PREFIX = 'digest:';

export interface Outgoing {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Shortens text to `max` characters with an ellipsis. */
export const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/**
 * Turns everything due for one phone at the same moment into ONE notification,
 * so people get at most one buzz a day. A weekly check-in already sums up the
 * week, so it leads and the rest are listed after it.
 */
export function combine(items: Array<Pick<ScheduledReminder, 'key' | 'title' | 'body' | 'url'>>): Outgoing {
  if (items.length === 1) {
    const [r] = items;
    return { title: r.title, body: r.body, url: r.url, tag: r.key };
  }
  const digest = items.find((r) => r.key.startsWith(DIGEST_PREFIX));
  const rest = items.filter((r) => r !== digest);
  if (digest) {
    return {
      title: digest.title,
      body: clip(`${digest.body}${digest.body ? ' ' : ''}Also: ${rest.map((r) => r.title).join('; ')}.`, 400),
      url: digest.url,
      tag: digest.key,
    };
  }
  return {
    title: `${items.length} reminders today`,
    body: clip(items.map((r) => r.title).join(' · '), 400),
    // Several cards: open Coming Up rather than one of them.
    url: `${items[0].url.split('#')[0]}#/`,
    tag: `bundle:${items[0].key}`,
  };
}
