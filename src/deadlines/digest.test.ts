import { describe, expect, it } from 'vitest';
import { emptyDraft, type Card } from '../data/types';
import { deadlines } from './deadlines';
import { checkinItems, upcomingSundays, weeklyDigest } from './digest';
import { remindable } from './filters';
import { localTime, scheduleReminders } from './schedule';

const today = '2026-10-11'; // a Sunday
let n = 0;
const card = (p: Partial<Card>): Card => ({ ...emptyDraft(today), id: `c${++n}`, createdAt: 0, updatedAt: 0, ...p });

const boots = card({ store: 'Target', title: 'Boots', total: 12000, returnBy: '2026-10-14' });
const sofa = card({ store: 'IKEA', title: 'Sofa', total: 49900, returnBy: '2026-12-01' }); // bought today, long window
const lamp = card({ store: 'IKEA', title: 'Lamp', total: 4000, date: '2026-08-01', returnBy: '2027-01-28' }); // long window, bought long ago
const milk = card({ store: 'Kroger', title: 'Milk', total: 499, category: 'grocery', returnBy: '2026-10-13' });
const socks = card({ store: 'Gap', title: 'Socks', total: 900, returnBy: '2026-10-20' });
const kept = card({ title: 'Chair', total: 8000, returnBy: '2026-10-20', returnStatus: 'kept' });
const coupon = card({ kind: 'coupon', store: "Kohl's", balance: 1000, total: 1000, expires: '2026-10-16' });
const gift = card({ kind: 'giftcard', store: 'Starbucks', balance: 1850, total: 5000 });
const credit = card({ kind: 'credit', store: 'Target', balance: 2500, total: 2500, expires: '2027-06-01' });
const all = [boots, sofa, lamp, milk, socks, kept, coupon, gift, credit];

describe('remindable', () => {
  it('skips groceries and small buys but never wallet items', () => {
    const list = deadlines(all, today);
    const names = list.filter((d) => remindable(d, 2000)).map((d) => `${d.name}:${d.kind}`);
    expect(names).not.toContain('Milk:return');
    expect(names).not.toContain('Socks:return');
    expect(names).toContain('Boots:return');
    expect(names).toContain('Coupon:expires');
    // Cut-off off: small buys come back, groceries never do.
    const allNames = list.filter((d) => remindable(d, 0)).map((d) => d.name);
    expect(allNames).toContain('Socks');
    expect(allNames).not.toContain('Milk');
  });

  it('still reminds when the price is unknown', () => {
    const [d] = deadlines([card({ title: 'Lamp', total: null, returnBy: '2026-10-14' })], today);
    expect(remindable(d, 2000)).toBe(true);
  });
});

describe('weekly check-in', () => {
  it('lists returns closing soon or bought recently, and soon-expiring wallet items', () => {
    const it = checkinItems(all, today, 2000);
    // The lamp has months left and was bought long ago: no weekly nagging about it.
    expect(it.returns.map((d) => d.name)).toEqual(['Boots', 'Sofa']);
    expect(it.expiring.map((d) => d.name)).toEqual(['Coupon']);
    expect(it.walletTotal).toBe(1850 + 2500);
    expect(it.atStake).toBe(12000 + 49900 + 1000);
  });

  it('writes a short notification', () => {
    const d = weeklyDigest(all, today, 'USD', 2000)!;
    expect(d.title).toBe('Sunday check-in: $629 you can still get back');
    expect(d.body).toBe("Boots (return by Wed), $10 Kohl's coupon (expires Fri), Sofa (return by Dec 1). $43.50 on gift cards and credit.");
  });

  it('says nothing in quiet weeks', () => {
    expect(weeklyDigest([gift, credit, kept], today, 'USD', 2000)).toBeNull();
    // A long window bought long ago stays quiet until its last 30 days.
    expect(weeklyDigest([lamp], today, 'USD', 2000)).toBeNull();
    expect(weeklyDigest([lamp], '2026-12-27', 'USD', 2000)).toBeNull();
    expect(weeklyDigest([lamp], '2027-01-03', 'USD', 2000)?.body).toBe('Lamp (return by Jan 28).');
  });

  it('finds the coming Sundays', () => {
    expect(upcomingSundays('2026-10-11', 2)).toEqual(['2026-10-11', '2026-10-18']);
    expect(upcomingSundays('2026-10-12', 1)).toEqual(['2026-10-18']);
  });
});

describe('schedule with check-in and cut-off', () => {
  const opts = { currency: 'USD', cardUrl: (id: string) => `https://k/#/card/${id}`, minAmount: 2000, checkin: { cards: all, url: 'https://k/#/checkin' } };

  it('adds future Sunday check-ins only for weeks with something to decide', () => {
    const s = scheduleReminders(deadlines(all, today), today, localTime(today, 7), opts);
    const digests = s.filter((r) => r.key.startsWith('digest:'));
    expect(digests[0]).toMatchObject({ key: 'digest:2026-10-11', fireAt: localTime('2026-10-11'), url: 'https://k/#/checkin' });
    // Boots & coupon are gone by Oct 18, but the sofa (bought Oct 11) is still worth deciding on.
    expect(digests.map((d) => d.key)).toContain('digest:2026-10-18');
    expect(digests.every((d) => d.fireAt >= localTime(today))).toBe(true);
  });

  it("never sends today's check-in late", () => {
    const s = scheduleReminders(deadlines(all, today), today, localTime(today, 15), opts);
    expect(s.map((r) => r.key)).not.toContain('digest:2026-10-11');
  });

  it('leaves out groceries and small buys', () => {
    const keys = scheduleReminders(deadlines(all, today), today, localTime(today, 7), opts).map((r) => r.key);
    expect(keys.some((k) => k.startsWith(milk.id + ':'))).toBe(false);
    expect(keys.some((k) => k.startsWith(socks.id + ':'))).toBe(false);
    expect(keys.some((k) => k.startsWith(boots.id + ':'))).toBe(true);
  });
});
