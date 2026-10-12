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
    expect(list.map((d) => `${d.name}:${d.kind}`)).toEqual(['Boots:return', 'Coupon:expires', 'Laptop:warranty', 'Chair:warranty']);
    expect(list[0].daysLeft).toBe(3);
    expect(list[0].urgency).toBe('week');
    expect(list[2].urgency).toBe('month');
    expect(list[3].urgency).toBe('later');
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
