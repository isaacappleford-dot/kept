import { describe, expect, it } from 'vitest';
import { findStore, guessCategory, suggestReturnBy, suggestWarranty } from './policy';

describe('store matching', () => {
  it('finds known stores in typed names and receipt text', () => {
    expect(findStore('Target')?.name).toBe('Target');
    expect(findStore('TARGET STORE T-1234\n123 Main St')?.name).toBe('Target');
    expect(findStore("KOHL'S #812")?.name).toBe("Kohl's");
    expect(findStore('Best Buy')?.name).toBe('Best Buy');
    expect(findStore('Order from Amazon.com')?.name).toBe('Amazon');
    expect(findStore("Joe's Hardware")).toBeNull();
  });

  it('does not match stores inside other words', () => {
    expect(findStore('targeted ads')).toBeNull();
    expect(findStore('cvsx')).toBeNull();
  });
});

describe('categories', () => {
  it('guesses from item names', () => {
    expect(guessCategory('Dyson V8 Vacuum')).toBe('appliance');
    expect(guessCategory('MacBook Air 13')).toBe('computer');
    expect(guessCategory('Leather boots')).toBe('shoes');
    expect(guessCategory('Sony WH-1000XM6 headphones')).toBe('electronics');
    expect(guessCategory('Mystery thing')).toBe('other');
  });
});

describe('return suggestions', () => {
  const base = { online: false, deliveryDate: null, category: 'other' as const };

  it('uses the store window', () => {
    const s = suggestReturnBy({ ...base, store: 'Target', date: '2026-06-01' });
    expect(s.date).toBe('2026-08-30');
    expect(s.days).toBe(90);
    expect(s.reason).toMatch(/Target usually allows 90 days/);
  });

  it('uses a shorter electronics window', () => {
    const s = suggestReturnBy({ ...base, store: 'Walmart', date: '2026-06-01', category: 'tv' });
    expect(s.date).toBe('2026-07-01');
    expect(s.reason).toMatch(/for electronics/);
  });

  it('applies holiday extensions', () => {
    const s = suggestReturnBy({ ...base, store: 'Best Buy', date: '2026-11-28', category: 'electronics' });
    expect(s.date).toBe('2027-01-14');
    expect(s.reason).toMatch(/holiday/);
  });

  it('starts online clocks at delivery', () => {
    const s = suggestReturnBy({ ...base, store: 'Amazon', date: '2026-06-01', deliveryDate: '2026-06-05' });
    expect(s.date).toBe('2026-07-05');
    expect(s.needsDelivery).toBe(false);
    const noDelivery = suggestReturnBy({ ...base, store: 'Amazon', date: '2026-06-01' });
    expect(noDelivery.needsDelivery).toBe(true);
    expect(noDelivery.date).toBe('2026-07-01');
  });

  it('falls back to 30 days for unknown stores and null for no-limit stores', () => {
    expect(suggestReturnBy({ ...base, store: 'Corner Shop', date: '2026-06-01' }).date).toBe('2026-07-01');
    expect(suggestReturnBy({ ...base, store: 'Costco', date: '2026-06-01' }).date).toBeNull();
    expect(suggestReturnBy({ ...base, store: 'Costco', date: '2026-06-01', category: 'tv' }).date).toBe('2026-08-30');
  });
});

describe('warranty suggestions', () => {
  it('suggests a year for electronics and nothing for clothing', () => {
    expect(suggestWarranty('computer', '2026-10-11').date).toBe('2027-10-11');
    expect(suggestWarranty('clothing', '2026-10-11').date).toBeNull();
  });
});
