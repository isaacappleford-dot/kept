import { describe, expect, it } from 'vitest';
import { findStore, guessCategory, isGroceryStore, priceCheck, sameStore, storeKey, storeSearchUrl, suggestReturnBy, suggestWarranty } from './policy';

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

describe('remembered store windows', () => {
  const base = { online: false, deliveryDate: null, category: 'other' as const };

  it('keys by store, with electronics apart where the store treats them differently', () => {
    expect(storeKey('TARGET T-1234', 'other')).toBe('target');
    expect(storeKey('Target', 'tv')).toBe('target|electronics');
    expect(storeKey('IKEA', 'tv')).toBe('ikea');
    expect(storeKey("  Rosie's   Boutique ", 'clothing')).toBe("rosie's boutique");
    expect(storeKey('', 'other')).toBeNull();
  });

  it('uses the window the user set', () => {
    const s = suggestReturnBy({ ...base, store: 'Target', date: '2026-06-01' }, { windows: { target: 60 } });
    expect(s.date).toBe('2026-07-31');
    expect(s.reason).toBe('You set Target to 60 days.');
    const local = suggestReturnBy({ ...base, store: "Rosie's Boutique", date: '2026-06-01' }, { windows: { "rosie's boutique": 14 } });
    expect(local.date).toBe('2026-06-15');
  });

  it('does not apply a normal window to electronics', () => {
    expect(suggestReturnBy({ ...base, store: 'Target', date: '2026-06-01', category: 'tv' }, { windows: { target: 60 } }).days).toBe(30);
  });
});

describe('memberships and card perks', () => {
  const base = { online: false, deliveryDate: null, category: 'other' as const };

  it('adds Target Circle Card days, including electronics', () => {
    const s = suggestReturnBy({ ...base, store: 'Target', date: '2026-06-01' }, { memberships: ['target-circle-card'] });
    expect(s.days).toBe(120);
    expect(s.reason).toBe('120 days with your Target Circle Card, from purchase.');
    expect(suggestReturnBy({ ...base, store: 'Target', date: '2026-06-01', category: 'tv' }, { memberships: ['target-circle-card'] }).days).toBe(60);
  });

  it('uses the member window at Best Buy and REI', () => {
    expect(suggestReturnBy({ ...base, store: 'Best Buy', date: '2026-06-01', category: 'tv' }, { memberships: ['my-best-buy'] }).days).toBe(60);
    expect(suggestReturnBy({ ...base, store: 'REI', date: '2026-06-01' }, { memberships: ['rei-member'] }).date).toBe('2027-06-01');
    expect(suggestReturnBy({ ...base, store: 'REI', date: '2026-06-01' }).days).toBe(90);
  });

  it('lets a window the user set win over a membership', () => {
    expect(suggestReturnBy({ ...base, store: 'Target', date: '2026-06-01' }, { memberships: ['target-circle-card'], windows: { target: 45 } }).days).toBe(45);
  });

  it('extends warranties with a credit card', () => {
    const w = suggestWarranty('computer', '2026-10-11', 12);
    expect(w.date).toBe('2027-10-11');
    expect(w.extended).toBe('2028-10-11');
    expect(suggestWarranty('clothing', '2026-10-11', 12).extended).toBeNull();
  });
});

describe('price checks and stores', () => {
  const p = (x: object) => ({ kind: 'purchase' as const, store: 'Target', date: '2026-10-01', total: 9900, returnBy: '2026-12-30', category: 'other' as const, ...x });

  it('knows how long stores refund a price drop', () => {
    expect(priceCheck(p({}))).toEqual({ until: '2026-10-15', store: 'Target' });
    expect(priceCheck(p({ store: 'Costco' }))?.until).toBe('2026-10-31');
    expect(priceCheck(p({ store: 'Best Buy', returnBy: '2026-10-16' }))?.until).toBe('2026-10-16');
    expect(priceCheck(p({ store: 'Walmart' }))).toBeNull();
    expect(priceCheck(p({ total: 2000 }))).toBeNull();
    expect(priceCheck(p({ category: 'grocery' }))).toBeNull();
  });

  it('links to the store’s own search, or a shopping search', () => {
    expect(storeSearchUrl('Target', 'Sony Headphones')).toBe('https://www.target.com/s?searchTerm=Sony%20Headphones');
    expect(storeSearchUrl("Rosie's Boutique", 'Scarf')).toBe("https://www.google.com/search?tbm=shop&q=Rosie's%20Boutique%20Scarf");
  });

  it('matches stores however they were typed, and knows grocery stores', () => {
    expect(sameStore('TARGET T-1234', 'Target')).toBe(true);
    expect(sameStore("rosie's boutique", "Rosie's  Boutique")).toBe(true);
    expect(sameStore('Target', 'Walmart')).toBe(false);
    expect(sameStore('', '')).toBe(false);
    expect(isGroceryStore("TRADER JOE'S #123")).toBe(true);
    expect(isGroceryStore('Target')).toBe(false);
  });
});
