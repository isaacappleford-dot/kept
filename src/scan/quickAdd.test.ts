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
