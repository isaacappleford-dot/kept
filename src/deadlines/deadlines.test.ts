import { describe, expect, it } from 'vitest';
import { emptyDraft, type Card } from '../data/types';
import { deadlines, groupDeadlines } from './deadlines';
import { dueReminders, reminderText, stageFor } from './reminders';

const today = '2026-10-11';
let n = 0;
function card(p: Partial<Card>): Card {
  return { ...emptyDraft(today), id: `c${++n}`, createdAt: 0, updatedAt: 0, ...p };
}

describe('deadlines', () => {
  it('lists open deadlines soonest first and skips resolved ones', () => {
    const boots = card({ store: 'Target', title: 'Boots', total: 12000, returnBy: '2026-10-14' });
    const laptop = card({ store: 'Best Buy', title: 'Laptop', total: 99900, returnBy: '2026-09-01', warrantyUntil: '2026-11-10' });
    const returned = card({ title: 'Lamp', returnBy: '2026-10-12', returnStatus: 'returned', warrantyUntil: '2027-01-01' });
    const kept = card({ title: 'Chair', returnBy: '2026-10-12', returnStatus: 'kept', warrantyUntil: '2027-01-01' });
    const coupon = card({ kind: 'coupon', store: "Kohl's", balance: 1000, expires: '2026-10-16' });
    const used = card({ kind: 'coupon', store: "Kohl's", balance: 1000, expires: '2026-10-13', used: true });
    const list = deadlines([boots, laptop, returned, kept, coupon, used], today);
    // $120 at Target also gets a price-drop check (Target usually adjusts for 14 days).
    expect(list.map((d) => `${d.name}:${d.kind}`)).toEqual(['Boots:return', 'Coupon:expires', 'Boots:price', 'Laptop:warranty', 'Chair:warranty']);
    expect(list[0].daysLeft).toBe(3);
    expect(list[0].urgency).toBe('week');
    expect(list[2].urgency).toBe('month'); // price check, 14 days
    expect(list[3].urgency).toBe('month'); // laptop warranty, 30 days
    expect(list[4].urgency).toBe('later');
  });

  it('keeps recently missed returns for a week, but never past warranties', () => {
    const missed = card({ title: 'Kettle', returnBy: '2026-10-08', warrantyUntil: '2026-10-01' });
    const old = card({ title: 'Old', returnBy: '2026-09-01' });
    const list = deadlines([missed, old], today);
    expect(list).toHaveLength(1);
    expect(list[0].urgency).toBe('past');
    expect(groupDeadlines(list)[0].title).toBe('Just missed');
  });

  it('prefers the later of standard and extended warranty', () => {
    const tv = card({ title: 'TV', warrantyUntil: '2027-01-01', extendedWarrantyUntil: '2029-01-01' });
    expect(deadlines([tv], today)[0].date).toBe('2029-01-01');
  });

  it('hides empty gift cards', () => {
    const empty = card({ kind: 'giftcard', balance: 0, expires: '2026-10-20' });
    expect(deadlines([empty], today)).toHaveLength(0);
  });
});

describe('reminders', () => {
  it('fires once per stage', () => {
    const boots = card({ store: 'Target', title: 'boots', total: 12000, returnBy: '2026-10-14' });
    const [d] = deadlines([boots], today);
    expect(stageFor(d)).toBe(3);
    const due = dueReminders([d], new Set(), today);
    expect(due).toHaveLength(1);
    expect(due[0].title).toBe('3 days left to return the boots ($120)');
    expect(dueReminders([d], new Set([due[0].key]), today)).toHaveLength(0);
  });

  it('does not remind too early', () => {
    const far = card({ title: 'Sofa', returnBy: '2026-12-01' });
    expect(dueReminders(deadlines([far], today), new Set(), today)).toHaveLength(0);
  });

  it('words warranty and coupon reminders like a person would', () => {
    const laptop = card({ title: 'laptop', warrantyUntil: '2026-11-10' });
    const coupon = card({ kind: 'coupon', store: "Kohl's", balance: 1000, expires: '2026-10-16' });
    const [w] = deadlines([laptop], today);
    const [c] = deadlines([coupon], today);
    expect(reminderText(w, today).title).toBe('Your laptop warranty ends in 30 days');
    expect(reminderText(w, today).body).toMatch(/acting up/);
    expect(reminderText(c, today).title).toBe("Your $10 coupon at Kohl's expires Friday");
  });
});

describe('started returns, price checks and charges', () => {
  it('turns a mailed, dropped-off return into a refund check that stays until answered', () => {
    const boots = card({ title: 'Boots', total: 12000, returnBy: '2026-10-14', returnStatus: 'returning', returnMethod: 'mail' });
    expect(deadlines([boots], today).map((d) => d.kind)).toEqual(['return']);
    const sent = { ...boots, droppedOffOn: '2026-09-20', refundCheckOn: '2026-09-30' };
    const [d] = deadlines([sent], today);
    expect(d.kind).toBe('refund');
    expect(d.daysLeft).toBe(-11); // overdue, still shown
    expect(reminderText(d, today).title).toBe('Did your $120 refund for the Boots arrive?');
  });

  it('words a started return as a drop-off or a trip to the store', () => {
    const mail = card({ title: 'boots', store: 'Target', total: 12000, returnBy: '2026-10-14', returnStatus: 'returning', returnMethod: 'mail' });
    const store = { ...mail, returnMethod: 'store' as const };
    expect(reminderText(deadlines([mail], today)[0], today).title).toBe('3 days left to drop off the boots ($120)');
    expect(reminderText(deadlines([store], today)[0], today).title).toBe('3 days left to take the boots back to Target ($120)');
  });

  it('checks price drops only for bigger buys at stores that adjust, until the user is done', () => {
    const tv = card({ store: 'Best Buy', title: 'TV', total: 49999, category: 'tv', returnBy: '2026-10-20' });
    const cheap = card({ store: 'Target', title: 'Socks', total: 900 });
    const walmart = card({ store: 'Walmart', title: 'Blender', total: 9900 });
    const done = { ...tv, id: 'done', priceStatus: 'done' as const };
    const prices = deadlines([tv, cheap, walmart, done], today).filter((d) => d.kind === 'price');
    expect(prices.map((d) => [d.name, d.date])).toEqual([['TV', '2026-10-20']]);
    expect(reminderText(prices[0], today).title).toBe('Did the TV get cheaper at Best Buy?');
  });

  it('reminds before a trial or subscription charges', () => {
    const trial = card({ kind: 'renewal', title: 'Netflix trial', store: 'Netflix', total: 1549, expires: '2026-10-16' });
    const [d] = deadlines([trial], today);
    expect(d.kind).toBe('charge');
    expect(reminderText(d, today).title).toBe('Your Netflix trial ends Friday ($15.49)');
    expect(deadlines([{ ...trial, used: true }], today)).toEqual([]);
  });
});

describe('review regressions', () => {
  it('rolls a yearly or monthly subscription forward when it was left to renew', () => {
    const costco = card({ kind: 'renewal', store: 'Costco', title: 'Membership', total: 6500, expires: '2026-03-01', repeat: 'yearly' });
    const [d] = deadlines([costco], today);
    expect(d.date).toBe('2027-03-01');
    const spotify = card({ kind: 'renewal', store: 'Spotify', title: 'Premium', total: 1199, expires: '2026-07-03', repeat: 'monthly' });
    expect(deadlines([spotify], today)[0].date).toBe('2026-11-03');
    const trial = card({ kind: 'renewal', store: 'Hulu', title: 'Free trial', expires: '2026-09-01', repeat: 'none' });
    expect(deadlines([trial], today)).toEqual([]);
  });

  it('names a trial by its service', () => {
    const t = card({ kind: 'renewal', store: 'Netflix', title: 'Free trial', total: 1549, expires: '2026-10-12' });
    const [d] = deadlines([t], today);
    expect(d.name).toBe('Netflix free trial');
    expect(reminderText(d, today).title).toBe('Your Netflix free trial ends tomorrow ($15.49)');
  });

  it('keeps an overdue refund check due, and reminds once', async () => {
    const { dueReminders } = await import('./reminders');
    const sent = card({ title: 'Boots', total: 12000, returnStatus: 'returning', returnMethod: 'mail', droppedOffOn: '2026-09-20', refundCheckOn: '2026-09-30' });
    const [d] = deadlines([sent], today);
    expect(d.urgency).toBe('week');
    const due = dueReminders([d], new Set(), today);
    expect(due).toHaveLength(1);
    expect(dueReminders([d], new Set([due[0].key]), today)).toHaveLength(0);
  });
});
