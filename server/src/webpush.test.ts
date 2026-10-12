import { describe, expect, it } from 'vitest';
import { b64url, encryptPayload, fromB64url, generateVapidKeys, sendPush, vapidAuthorization } from './webpush';

const enc = new TextEncoder();

async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data as BufferSource));
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const prk = await hmac(salt, ikm);
  const one = new Uint8Array(info.length + 1);
  one.set(info);
  one[info.length] = 1;
  return (await hmac(prk, one)).slice(0, len);
}
const cat = (...p: Uint8Array[]) => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of p) {
    out.set(x, i);
    i += x.length;
  }
  return out;
};

/** A fake browser: makes a subscription and decrypts what the server sends (the receiving side of RFC 8291). */
async function fakeBrowser() {
  const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const uaPublic = new Uint8Array((await crypto.subtle.exportKey('raw', ua.publicKey)) as ArrayBuffer);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const sub = { endpoint: 'https://push.example.com/send/abc123', keys: { p256dh: b64url(uaPublic), auth: b64url(auth) } };
  const decrypt = async (body: Uint8Array) => {
    const salt = body.slice(0, 16);
    const idlen = body[20];
    const asPublic = body.slice(21, 21 + idlen);
    const ciphertext = body.slice(21 + idlen);
    const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
    const ikm = await hkdf(auth, shared, cat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
    const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext));
    expect(plain[plain.length - 1]).toBe(2);
    return new TextDecoder().decode(plain.slice(0, -1));
  };
  return { sub, decrypt };
}

describe('web push', () => {
  it('round-trips base64url', () => {
    const bytes = new Uint8Array([0, 255, 62, 63, 1, 2, 3]);
    expect(fromB64url(b64url(bytes))).toEqual(bytes);
    expect(b64url(bytes)).not.toMatch(/[+/=]/);
  });

  it('encrypts so the browser can decrypt (RFC 8291)', async () => {
    const browser = await fakeBrowser();
    const body = await encryptPayload(browser.sub, enc.encode('{"title":"3 days left"}'));
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(body[20]).toBe(65);
    expect(await browser.decrypt(body)).toBe('{"title":"3 days left"}');
  });

  it('signs a valid VAPID JWT (RFC 8292)', async () => {
    const keys = await generateVapidKeys();
    expect(fromB64url(keys.publicKey)).toHaveLength(65);
    const header = await vapidAuthorization('https://web.push.apple.com/abc', keys, 'mailto:test@example.com', 1_700_000_000_000);
    const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header)!;
    expect(m).not.toBeNull();
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(m[2])));
    expect(claims).toEqual({ aud: 'https://web.push.apple.com', exp: 1_700_000_000 + 43200, sub: 'mailto:test@example.com' });
    const pub = await crypto.subtle.importKey('raw', fromB64url(m[4]) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, fromB64url(m[3]) as BufferSource, enc.encode(`${m[1]}.${m[2]}`));
    expect(ok).toBe(true);
  });

  it('posts to the endpoint and reports dead subscriptions', async () => {
    const browser = await fakeBrowser();
    const keys = await generateVapidKeys();
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fake = (status: number) =>
      (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(null, { status });
      }) as unknown as typeof fetch;
    const ok = await sendPush(browser.sub, { title: 'Hi' }, keys, 'mailto:a@b.c', fake(201));
    expect(ok).toEqual({ ok: true, status: 201, gone: false });
    const h = calls[0].init.headers as Record<string, string>;
    expect(h['Content-Encoding']).toBe('aes128gcm');
    expect(await browser.decrypt(calls[0].init.body as Uint8Array)).toBe('{"title":"Hi"}');
    expect((await sendPush(browser.sub, {}, keys, 'mailto:a@b.c', fake(410))).gone).toBe(true);
  });
});
