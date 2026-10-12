/**
 * Kept reminders server (Cloudflare Worker + one SQLite Durable Object).
 *
 * Each phone that turns on reminders sends its push subscription and its
 * upcoming reminders. A Durable Object alarm wakes up when the next one is due
 * and delivers it with Web Push, so reminders arrive even when the app is closed.
 * The VAPID keys are generated on first use and kept in the object's storage,
 * so there are no secrets to configure.
 */
import { DurableObject } from 'cloudflare:workers';
import { combine, validateSync, type SyncRequest } from './protocol';
import { generateVapidKeys, sendPush, type VapidKeys } from './webpush';

export interface Env {
  STORE: DurableObjectNamespace<PushStore>;
  VAPID_SUBJECT: string;
  /** Local testing only (set in .dev.vars): accept http://localhost push endpoints. */
  ALLOW_LOCAL_ENDPOINTS?: string;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class PushStore extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS subs (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS reminders (sub_id TEXT NOT NULL, key TEXT NOT NULL, fire_at INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT NOT NULL, PRIMARY KEY (sub_id, key));
      CREATE INDEX IF NOT EXISTS reminders_fire ON reminders (fire_at);
      CREATE TABLE IF NOT EXISTS sent (sub_id TEXT NOT NULL, key TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (sub_id, key));
    `);
  }

  async vapidKeys(): Promise<VapidKeys> {
    const row = this.sql.exec<{ value: string }>(`SELECT value FROM meta WHERE key = 'vapid'`).toArray()[0];
    if (row) return JSON.parse(row.value) as VapidKeys;
    const keys = await generateVapidKeys();
    this.sql.exec(`INSERT INTO meta (key, value) VALUES ('vapid', ?)`, JSON.stringify(keys));
    return keys;
  }

  async publicKey(): Promise<string> {
    return (await this.vapidKeys()).publicKey;
  }

  /** Replaces this phone's upcoming reminders. */
  async sync(req: SyncRequest): Promise<number> {
    const id = await sha256(req.subscription.endpoint);
    const now = Date.now();
    this.sql.exec(
      `INSERT INTO subs (id, endpoint, p256dh, auth, updated) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, updated = excluded.updated`,
      id,
      req.subscription.endpoint,
      req.subscription.keys.p256dh,
      req.subscription.keys.auth,
      now,
    );
    this.sql.exec(`DELETE FROM reminders WHERE sub_id = ?`, id);
    const sent = new Set(this.sql.exec<{ key: string }>(`SELECT key FROM sent WHERE sub_id = ?`, id).toArray().map((r) => r.key));
    let count = 0;
    for (const r of req.reminders) {
      // Skip anything already delivered or more than a day stale.
      if (sent.has(r.key) || r.fireAt < now - DAY) continue;
      this.sql.exec(`INSERT OR REPLACE INTO reminders (sub_id, key, fire_at, title, body, url) VALUES (?, ?, ?, ?, ?, ?)`, id, r.key, r.fireAt, r.title, r.body, r.url);
      count++;
    }
    await this.scheduleNext();
    return count;
  }

  async unsubscribe(endpoint: string) {
    const id = await sha256(endpoint);
    this.sql.exec(`DELETE FROM reminders WHERE sub_id = ?`, id);
    this.sql.exec(`DELETE FROM sent WHERE sub_id = ?`, id);
    this.sql.exec(`DELETE FROM subs WHERE id = ?`, id);
  }

  private async scheduleNext(retrySoon = false) {
    const next = this.sql.exec<{ t: number | null }>(`SELECT MIN(fire_at) AS t FROM reminders`).toArray()[0]?.t ?? null;
    const now = Date.now();
    let at = next === null ? null : Math.max(next, now + 1000);
    if (retrySoon) at = Math.min(at ?? Infinity, now + 15 * MINUTE);
    if (at === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(at);
  }

  async alarm() {
    const now = Date.now();
    const keys = await this.vapidKeys();
    this.sql.exec(`DELETE FROM reminders WHERE fire_at < ?`, now - DAY);
    this.sql.exec(`DELETE FROM sent WHERE at < ?`, now - 90 * DAY);
    this.sql.exec(`DELETE FROM subs WHERE updated < ? AND id NOT IN (SELECT DISTINCT sub_id FROM reminders)`, now - 180 * DAY);

    const due = this.sql
      .exec<{ sub_id: string; key: string; title: string; body: string; url: string; endpoint: string; p256dh: string; auth: string }>(
        `SELECT r.sub_id, r.key, r.title, r.body, r.url, s.endpoint, s.p256dh, s.auth
         FROM reminders r JOIN subs s ON s.id = r.sub_id WHERE r.fire_at <= ? ORDER BY r.fire_at LIMIT 200`,
        now,
      )
      .toArray();

    // Everything due for one phone right now goes out as ONE notification.
    const byPhone = new Map<string, typeof due>();
    for (const r of due) byPhone.set(r.sub_id, [...(byPhone.get(r.sub_id) ?? []), r]);
    const groups = [...byPhone.values()];

    let retry = false;
    for (let i = 0; i < groups.length; i += 20) {
      await Promise.all(
        groups.slice(i, i + 20).map(async (rows) => {
          const sub = rows[0];
          try {
            const res = await sendPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, combine(rows), keys, this.env.VAPID_SUBJECT);
            if (res.gone) {
              await this.unsubscribe(sub.endpoint);
            } else if (res.ok) {
              for (const r of rows) {
                this.sql.exec(`DELETE FROM reminders WHERE sub_id = ? AND key = ?`, r.sub_id, r.key);
                this.sql.exec(`INSERT OR REPLACE INTO sent (sub_id, key, at) VALUES (?, ?, ?)`, r.sub_id, r.key, now);
              }
            } else retry = true;
          } catch {
            retry = true;
          }
        }),
      );
    }
    await this.scheduleNext(retry || due.length === 200);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const store = env.STORE.get(env.STORE.idFromName('global'));

    if (request.method === 'GET' && url.pathname === '/vapid') return json({ publicKey: await store.publicKey() });
    if (request.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'kept-reminders' });

    if (request.method === 'POST' && (url.pathname === '/sync' || url.pathname === '/unsubscribe')) {
      if (Number(request.headers.get('Content-Length') ?? 0) > 128 * 1024) return json({ error: 'Too large' }, 413);
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Expected JSON' }, 400);
      }
      if (url.pathname === '/unsubscribe') {
        const endpoint = (body as { endpoint?: unknown })?.endpoint;
        if (typeof endpoint !== 'string') return json({ error: 'Missing endpoint' }, 400);
        await store.unsubscribe(endpoint);
        return json({ ok: true });
      }
      const err = validateSync(body, { allowLocalEndpoints: env.ALLOW_LOCAL_ENDPOINTS === '1' });
      if (err) return json({ error: err }, 400);
      return json({ ok: true, scheduled: await store.sync(body as SyncRequest) });
    }
    return json({ error: 'Not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
