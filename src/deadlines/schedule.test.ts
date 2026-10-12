import { describe, expect, it } from 'vitest';
import { emptyDraft, type Card } from '../data/types';
import { deadlines } from './deadlines';
import { localTime, scheduleReminders } from './schedule';

const today = '2026-10-11';
const card = (p: Partial<Card>): Card => ({ ...emptyDraft(today), id: 'c1', createdAt: 0, updatedAt: 0, ...p });
const url = (id: string) => `https://kept.app/#/card/${id}`;
const opts = { currency: 'USD', cardUrl: url };

describe('scheduleReminders', () => {
  it('sends the current stage now and later stages at 9 am on their day', () => {
    const now = localTime(today, 15);
    const list = deadlines([card({ store: 'Target', title: 'boots', total: 12000, returnBy: '2026-10-14' })], today);
    const s = scheduleReminders(list, today, now, opts);
    expect(s.map((r) => r.key)).toEqual(['c1:return:2026-10-14:3', 'c1:return:2026-10-14:1', 'c1:return:2026-10-14:0', 'c1:price:2026-10-25:5', 'c1:price:2026-10-25:1']);
    expect(s[0].fireAt).toBe(now);
    expect(s[0].title).toBe('3 days left to return the boots ($120)');
    expect(s[1].fireAt).toBe(localTime('2026-10-13'));
    expect(s[1].title).toBe('1 day left to return the boots ($120)');
    expect(s[2].title).toBe('Last day to return the boots ($120)');
    expect(s[2].url).toBe('https://kept.app/#/card/c1');
  });

  it('waits until 9 am for the current stage early in the morning', () => {
    const list = deadlines([card({ title: 'boots', returnBy: '2026-10-14' })], today);
    expect(scheduleReminders(list, today, localTime(today, 6), opts)[0].fireAt).toBe(localTime(today));
  });

  it('schedules far deadlines only at their lead days', () => {
    const list = deadlines([card({ title: 'laptop', warrantyUntil: '2027-01-10' })], today);
    const s = scheduleReminders(list, today, localTime(today, 12), opts);
    expect(s.map((r) => r.key)).toEqual(['c1:warranty:2027-01-10:30', 'c1:warranty:2027-01-10:7']);
    expect(s[0].fireAt).toBe(localTime('2026-12-11'));
    expect(s[0].title).toBe('Your laptop warranty ends in 30 days');
  });

  it('skips resolved and past deadlines', () => {
    const list = deadlines([card({ title: 'x', returnBy: '2026-10-08' }), card({ id: 'c2', title: 'y', returnBy: '2026-10-20', returnStatus: 'kept' })], today);
    expect(scheduleReminders(list, today, localTime(today, 12), opts)).toEqual([]);
  });
});
