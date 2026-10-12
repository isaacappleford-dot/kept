import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quickAdd';

const today = '2026-10-11'; // a Sunday

describe('parseQuickAdd', () => {
  it('reads the example from the concept', () => {
    const q = parseQuickAdd('Got a vacuum at Target, 90-day return', today);
    expect(q.kind).toBe('purchase');
    expect(q.title).toBe('Vacuum');
    expect(q.store).toBe('Target');
    expect(q.date).toBe(today);
    expect(q.returnBy).toBe('2027-01-09');
    expect(q.category).toBe('appliance');
  });

  it('reads price, date and warranty', () => {
    const q = parseQuickAdd('Headphones $120 from Best Buy yesterday, 2 year warranty', today);
    expect(q.title).toBe('Headphones');
    expect(q.total).toBe(12000);
    expect(q.store).toBe('Best Buy');
    expect(q.date).toBe('2026-10-10');
    expect(q.warrantyUntil).toBe('2028-10-10');
    expect(q.returnBy).toBeNull();
  });

  it('reads store credit with an expiry', () => {
    const q = parseQuickAdd('$25 store credit at Target, expires Dec 31', today);
    expect(q.kind).toBe('credit');
    expect(q.total).toBe(2500);
    expect(q.store).toBe('Target');
    expect(q.expires).toBe('2026-12-31');
  });

  it('reads a coupon expiring on a weekday', () => {
    const q = parseQuickAdd("$10 coupon at Kohl's expires Friday", today);
    expect(q.kind).toBe('coupon');
    expect(q.total).toBe(1000);
    expect(q.store).toBe("Kohl's");
    expect(q.expires).toBe('2026-10-16');
  });

  it('reads an online order with a delivery date', () => {
    const q = parseQuickAdd('Ordered boots on Amazon for $89, arrives Friday', today);
    expect(q.title).toBe('Boots');
    expect(q.store).toBe('Amazon');
    expect(q.online).toBe(true);
    expect(q.deliveryDate).toBe('2026-10-16');
    expect(q.total).toBe(8900);
    expect(q.category).toBe('shoes');
  });

  it('reads unknown stores and gift recipients', () => {
    const q = parseQuickAdd("Bought a scarf at Rosie's Boutique, gift for Sam", today);
    expect(q.title).toBe('Scarf');
    expect(q.store).toBe("Rosie's Boutique");
    expect(q.giftFor).toBe('Sam');
  });

  it('handles a return window in weeks and purchases last Friday', () => {
    const q = parseQuickAdd('Picked up a desk lamp at IKEA last Friday, 2 week return', today);
    expect(q.title).toBe('Desk lamp');
    expect(q.store).toBe('IKEA');
    expect(q.date).toBe('2026-10-09');
    expect(q.returnBy).toBe('2026-10-23');
  });
});

describe('trials and subscriptions', () => {
  it('reads a trial that ends on a weekday', () => {
    const q = parseQuickAdd('Netflix trial ends Friday $15.49', today);
    expect(q.kind).toBe('renewal');
    expect(q.store).toBe('Netflix');
    expect(q.title).toBe('Netflix trial');
    expect(q.expires).toBe('2026-10-16');
    expect(q.total).toBe(1549);
    expect(q.repeat).toBe('none');
  });

  it('reads a membership that renews in a month', () => {
    const q = parseQuickAdd('Costco membership renews in March, $65', today);
    expect(q.kind).toBe('renewal');
    expect(q.store).toBe('Costco');
    expect(q.expires).toBe('2027-03-01');
    expect(q.total).toBe(6500);
    expect(q.repeat).toBe('yearly');
  });

  it('reads a monthly subscription with a date', () => {
    const q = parseQuickAdd('Spotify $11.99 monthly renews Nov 3', today);
    expect(q.kind).toBe('renewal');
    expect(q.store).toBe('Spotify');
    expect(q.expires).toBe('2026-11-03');
    expect(q.repeat).toBe('monthly');
  });

  it('reads "ends in N days"', () => {
    const q = parseQuickAdd('Hulu trial ends in 5 days $9.99', today);
    expect(q.expires).toBe('2026-10-16');
    expect(q.total).toBe(999);
    expect(q.store).toBe('Hulu');
  });

  it('still reads store credit and returns as before', () => {
    expect(parseQuickAdd('$25 store credit at Target, expires Dec 31', today).kind).toBe('credit');
    expect(parseQuickAdd('Got a vacuum at Target, 90-day return', today).kind).toBe('purchase');
  });
});

describe('trial detection (review regressions)', () => {
  it('keeps ordinary purchases as purchases', () => {
    expect(parseQuickAdd('Got AirPods at Best Buy with my membership $199', today).kind).toBe('purchase');
    expect(parseQuickAdd('Bought trial size shampoo at CVS $5', today).kind).toBe('purchase');
    expect(parseQuickAdd('Bought renewing serum at Sephora $45', today).kind).toBe('purchase');
    expect(parseQuickAdd('Picked up a membership card holder at Target $12', today).kind).toBe('purchase');
  });

  it('reads "renews in <this month>" as now, and "the 3rd" as the next 3rd', () => {
    expect(parseQuickAdd('Amazon Prime membership renews in October $139', today).expires).toBe(today);
    const q = parseQuickAdd('Spotify subscription $11.99 monthly, renews the 3rd', today);
    expect(q.kind).toBe('renewal');
    expect(q.expires).toBe('2026-11-03');
    expect(q.store).toBe('Spotify');
  });

  it('looks past a trigger word without a date', () => {
    expect(parseQuickAdd('Spotify subscription charges me monthly, renews Nov 3', today).expires).toBe('2026-11-03');
  });
});
