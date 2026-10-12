import { describe, expect, it } from 'vitest';
import { MAX_REMINDERS, validateSync } from './protocol';

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
