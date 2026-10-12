import { describe, expect, it } from 'vitest';
import { combine, MAX_REMINDERS, validateSync } from './protocol';

const sub = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'BKey', auth: 'auth' } };
const r = { key: 'c1:return:2026-10-15:3', fireAt: 1, title: '3 days left', body: '', url: 'https://x/#/card/c1' };

describe('validateSync', () => {
  it('accepts a good request', () => expect(validateSync({ subscription: sub, reminders: [r] })).toBeNull());
  it('rejects bad input', () => {
    expect(validateSync(null)).toBeTruthy();
    expect(validateSync({ subscription: { ...sub, endpoint: 'http://insecure' }, reminders: [] })).toMatch(/endpoint/);
    expect(validateSync({ subscription: { ...sub, endpoint: 'http://localhost:9/x' }, reminders: [] })).toMatch(/endpoint/);
    expect(validateSync({ subscription: { ...sub, endpoint: 'http://localhost:9/x' }, reminders: [] }, { allowLocalEndpoints: true })).toBeNull();
    expect(validateSync({ subscription: { endpoint: sub.endpoint }, reminders: [] })).toMatch(/keys/);
    expect(validateSync({ subscription: sub, reminders: [{ ...r, fireAt: 'soon' }] })).toMatch(/time/);
    expect(validateSync({ subscription: sub, reminders: Array(MAX_REMINDERS + 1).fill(r) })).toMatch(/reminders/);
  });
});

describe('combine', () => {
  const a = { key: 'c1:return:2026-10-15:3', title: '3 days left to return the boots ($120)', body: 'Return window at Target ends Thursday.', url: 'https://x.io/kept/#/card/c1' };
  const b = { key: 'c2:warranty:2026-11-10:30', title: 'Your laptop warranty ends in 30 days', body: 'Anything acting up?', url: 'https://x.io/kept/#/card/c2' };
  const d = { key: 'digest:2026-10-11', title: 'Sunday check-in: $130 you can still get back', body: 'Boots (Thu), $10 Kohl’s coupon (Fri).', url: 'https://x.io/kept/#/checkin' };

  it('passes a single reminder through', () => {
    expect(combine([a])).toEqual({ title: a.title, body: a.body, url: a.url, tag: a.key });
  });

  it('bundles several into one notification that opens Coming Up', () => {
    const out = combine([a, b]);
    expect(out.title).toBe('2 reminders today');
    expect(out.body).toBe(`${a.title} · ${b.title}`);
    expect(out.url).toBe('https://x.io/kept/#/');
  });

  it('lets the weekly check-in lead and lists the rest', () => {
    const out = combine([a, d, b]);
    expect(out.title).toBe(d.title);
    expect(out.url).toBe(d.url);
    expect(out.body).toBe(`${d.body} Also: ${a.title}; ${b.title}.`);
  });

  it('keeps the body short', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...a, key: `k${i}` }));
    expect(combine(many).body.length).toBeLessThanOrEqual(400);
  });
});
