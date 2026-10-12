import { describe, expect, it } from 'vitest';
import { findDates, parseRelative } from './parseDate';
import { parseReceipt } from './parseReceipt';

const today = '2026-10-11';

const TARGET = `
TARGET
Expect More. Pay Less.
1234 Main Street
Springfield, IL 62701
(217) 555-0100
10/09/2026 14:32
ELECTRONICS
212345678 SONY HEADPHONES     NF   $99.99
HOME
049123456 THROW PILLOW        NF   $24.99
SUBTOTAL                          $124.98
T = IL TAX 8.75% on $124.98        $10.94
TOTAL                             $135.92
*1234 VISA CHARGE                 $135.92
RETURN POLICY: 90 DAYS
`;

const GROCERY = `
Fresh Fields Market
88 Elm Ave
Oct 3, 2026  9:12 AM
BANANAS 1.29
MILK 2% GAL 4.49
SOURDOUGH BREAD 5.99
SUBTOTAL 11.77
TAX 0.00
BALANCE DUE 11.77
CASH 20.00
CHANGE 8.23
`;

const ONLINE = `
amazon.com
Order Confirmation
Order # 112-1234567-1234567
Ordered on September 28, 2026
Dyson V8 Cordless Vacuum $349.99
Shipping $0.00
Order Total: $349.99
Arriving Thursday
`;

const COUPON = `
KOHL'S
$10 OFF
your purchase of $50 or more
Valid 10/01/2026 - 10/16/2026
Expires 10/16/26
Promo code: SAVE10NOW
`;

const CREDIT = `
TARGET
MERCHANDISE RETURN CARD
Store credit balance: $25.00
Card number 6124 5555 1234 0000
`;

describe('parseReceipt', () => {
  it('reads a store receipt', () => {
    const r = parseReceipt(TARGET, today);
    expect(r.kind).toBe('purchase');
    expect(r.store).toBe('Target');
    expect(r.date).toBe('2026-10-09');
    expect(r.total).toBe(13592);
    expect(r.items).toEqual([
      { name: 'Sony Headphones', price: 9999 },
      { name: 'Throw Pillow', price: 2499 },
    ]);
    expect(r.category).toBe('electronics');
    expect(r.online).toBe(false);
    expect(r.unsure).toEqual([]);
  });

  it('reads an unknown store, "balance due" and ignores cash/change', () => {
    const r = parseReceipt(GROCERY, today);
    expect(r.store).toBe('Fresh Fields Market');
    expect(r.unsure).toContain('store');
    expect(r.date).toBe('2026-10-03');
    expect(r.total).toBe(1177);
    expect(r.items.map((i) => i.name)).toEqual(['Bananas', 'Milk 2% Gal', 'Sourdough Bread']);
    expect(r.category).toBe('grocery');
  });

  it('recognises an online order', () => {
    const r = parseReceipt(ONLINE, today);
    expect(r.store).toBe('Amazon');
    expect(r.online).toBe(true);
    expect(r.date).toBe('2026-09-28');
    expect(r.total).toBe(34999);
    expect(r.items[0]).toEqual({ name: 'Dyson V8 Cordless Vacuum', price: 34999 });
    expect(r.category).toBe('appliance');
  });

  it('recognises a coupon with value, expiry and code', () => {
    const r = parseReceipt(COUPON, today);
    expect(r.kind).toBe('coupon');
    expect(r.store).toBe("Kohl's");
    expect(r.value).toBe(1000);
    expect(r.expires).toBe('2026-10-16');
    expect(r.code).toBe('SAVE10NOW');
  });

  it('recognises store credit', () => {
    const r = parseReceipt(CREDIT, today);
    expect(r.kind).toBe('credit');
    expect(r.value).toBe(2500);
    expect(r.unsure).toContain('expires');
  });

  it('copes with noise and empty text', () => {
    const r = parseReceipt('', today);
    expect(r.store).toBe('');
    expect(r.total).toBeNull();
    expect(r.unsure).toEqual(['store', 'date', 'total', 'items']);
  });
});

describe('findDates', () => {
  it('reads common formats', () => {
    expect(findDates('10/09/2026', today)[0].date).toBe('2026-10-09');
    expect(findDates('10/09/26', today)[0].date).toBe('2026-10-09');
    expect(findDates('2026-10-09', today)[0].date).toBe('2026-10-09');
    expect(findDates('Oct 9, 2026', today)[0].date).toBe('2026-10-09');
    expect(findDates('9 October 2026', today)[0].date).toBe('2026-10-09');
    expect(findDates('25/12/2026', today)[0].date).toBe('2026-12-25'); // day-first when month-first is impossible
  });

  it('chooses the year for dates without one', () => {
    expect(findDates('Dec 31', today)[0].date).toBe('2025-12-31');
    expect(findDates('Dec 31', today, { future: true })[0].date).toBe('2026-12-31');
    expect(findDates('Jan 5', today, { future: true })[0].date).toBe('2027-01-05');
  });

  it('ignores times and prices', () => {
    expect(findDates('14:32 $99.99 12.50', today)).toEqual([]);
  });
});

describe('parseRelative', () => {
  it('reads spoken dates', () => {
    expect(parseRelative('expires friday', today, 'future')).toBe('2026-10-16');
    expect(parseRelative('on friday', today, 'past')).toBe('2026-10-09');
    expect(parseRelative('yesterday', today, 'past')).toBe('2026-10-10');
    expect(parseRelative('in 2 weeks', today, 'future')).toBe('2026-10-25');
    expect(parseRelative('end of the month', today, 'future')).toBe('2026-10-31');
    expect(parseRelative('nothing here', today, 'future')).toBeNull();
  });
});
