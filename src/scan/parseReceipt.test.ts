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

const AMAZON_EMAIL = `
Amazon.com
Hello Sam,
Thanks for your order. We'll let you know once your item(s) have shipped.
Arriving Thursday
Order # 112-1234567-1234567
Ordered on October 6, 2026
Dyson V8 Cordless Vacuum Cleaner
Qty: 1
$349.99
Anker USB-C Charger 65W
Quantity: 2
$39.98
Item(s) Subtotal: $389.97
Order Total: $419.21
Get $10 off your next order with promo code SAVE10
`;

const HOME_DEPOT = `
THE HOME DEPOT
10/02/26 09:15 AM
DEWALT 20V DRILL KIT   129.00
SUBTOTAL 129.00
TOTAL 139.97
RETURN POLICY DEFINITIONS
POLICY ID  DAYS  POLICY EXPIRES ON
A          90    12/31/2026
`;

const BOUTIQUE = `
Rosie's Boutique
09/30/2026
Silk Scarf 45.00
TOTAL 45.00
Returns accepted within 14 days with receipt.
`;

const PRINTED = `
CORNER HARDWARE
10/01/2026
HAMMER 19.99
TOTAL 21.59
RETURN BY: 10/31/2026
`;

describe('order emails and printed return dates', () => {
  it('reads an order email: order date, delivery, items on their own lines, not a coupon', () => {
    const r = parseReceipt(AMAZON_EMAIL, today);
    expect(r.kind).toBe('purchase');
    expect(r.store).toBe('Amazon');
    expect(r.date).toBe('2026-10-06');
    expect(r.online).toBe(true);
    // Ordered Tue Oct 6, "Arriving Thursday" → Oct 8, even though it's pasted on Oct 11.
    expect(r.deliveryDate).toBe('2026-10-08');
    expect(r.unsure).toContain('delivery');
    expect(r.total).toBe(41921);
    expect(r.items).toEqual([
      { name: 'Dyson V8 Cordless Vacuum Cleaner', price: 34999 },
      { name: 'Anker Usb-C Charger 65w', price: 3998 },
    ]);
  });

  it('uses an exact printed return date and does not mistake it for the purchase date', () => {
    const r = parseReceipt(PRINTED, today);
    expect(r.date).toBe('2026-10-01');
    expect(r.printedReturnBy).toBe('2026-10-31');
  });

  it('reads "policy expires on" tables', () => {
    const r = parseReceipt(HOME_DEPOT, today);
    expect(r.store).toBe('The Home Depot');
    expect(r.date).toBe('2026-10-02');
    expect(r.printedReturnBy).toBe('2026-12-31');
  });

  it('reads "within N days"', () => {
    const r = parseReceipt(BOUTIQUE, today);
    expect(r.printedReturnBy).toBeNull();
    expect(r.printedReturnDays).toBe(14);
  });

  it('ignores past "delivered" dates far away and missing return lines', () => {
    const r = parseReceipt(TARGET, today);
    expect(r.printedReturnBy).toBeNull();
    expect(r.printedReturnDays).toBe(90);
    expect(r.deliveryDate).toBeNull();
  });
});

describe('review regressions', () => {
  it('counts "Arriving Thursday" from the order date, whatever day it is pasted', () => {
    const email = 'amazon.com\nOrder # 112-1\nOrdered on October 12, 2026\nArriving Thursday\nBoots\n$89.00\nOrder Total: $89.00';
    expect(parseReceipt(email, '2026-10-15').deliveryDate).toBe('2026-10-15');
    expect(parseReceipt(email, '2026-10-19').deliveryDate).toBe('2026-10-15');
  });

  it('skips a delivery keyword without a date and keeps delivery dates out of the purchase date', () => {
    const email = 'Target\nYour order is on its way!\nDelivered by: UPS\nArrives by Thu, Oct 15\nOrder #9012345\nLamp\n$40.00';
    const r = parseReceipt(email, '2026-10-12');
    expect(r.deliveryDate).toBe('2026-10-15');
    expect(r.date).not.toBe('2025-10-15');
  });

  it('ignores refund-processing and shipping times', () => {
    const a = "Rosie's Boutique\n09/30/2026\nScarf 45.00\nTOTAL 45.00\nPlease allow 5-7 days for refunds to post.\nReturns accepted within 30 days";
    expect(parseReceipt(a, today).printedReturnDays).toBe(30);
    const b = "Rosie's Boutique\n09/30/2026\nScarf 45.00\nRefunds are processed within 5 days of receiving your return.";
    expect(parseReceipt(b, today).printedReturnDays).toBeNull();
    const c = "Rosie's Boutique\n09/30/2026\nProcessing time: 1-3 days\nReturn policy: 30 days";
    expect(parseReceipt(c, today).printedReturnDays).toBe(30);
  });

  it('never takes the purchase date or an unrelated line as the printed return date', () => {
    const a = 'CORNER HARDWARE\nRefunds by original form of payment only.\n10/05/2026 2:22 PM\nHAMMER 19.99\nTOTAL 21.59';
    const ra = parseReceipt(a, today);
    expect(ra.date).toBe('2026-10-05');
    expect(ra.printedReturnBy).toBeNull();
    const b = 'CORNER HARDWARE\n10/01/2026\nHAMMER 19.99\nReturns by mail: see website\nSurvey ends 10/19/2026';
    expect(parseReceipt(b, today).printedReturnBy).toBeNull();
    const c = 'CORNER HARDWARE\n10/01/2026\nHAMMER 19.99\nRETURN/EXCHANGE BY:\n10/31/2026';
    expect(parseReceipt(c, today).printedReturnBy).toBe('2026-10-31');
  });

  it('takes the earliest row of a policy table and ignores protection-plan expiry', () => {
    const hd = 'THE HOME DEPOT\n10/02/26 09:15 AM\nGENERATOR 899.00\nDRILL 129.00\nTOTAL 1100.00\nPOLICY ID  DAYS  POLICY EXPIRES ON\nA 1 90 12/31/2026\nB 1 30 11/01/2026';
    expect(parseReceipt(hd, today).printedReturnBy).toBe('2026-11-01');
    const bb = 'BEST BUY\n10/02/2026\nLAPTOP 999.00\nTOTAL 999.00\nProtection plan policy expires 10/02/2027';
    expect(parseReceipt(bb, today).printedReturnBy).toBeNull();
  });

  it('keeps coupons with "Limit one per order / No cash value" as coupons', () => {
    const c = '$5 OFF\nany purchase of $25 or more\nLimit one per order\nNo cash value\nExpires 10/31/2026\nCode: 5OFF25';
    const r = parseReceipt(c, today);
    expect(r.kind).toBe('coupon');
    expect(r.expires).toBe('2026-10-31');
  });

  it('does not mistake stores starting with Hi/Hey/Dear for greetings', () => {
    expect(parseReceipt('HIGHLAND HARDWARE\n456 Oak Ave\n10/01/2026\nNAILS 4.99\nTOTAL 4.99', today).store).toBe('Highland Hardware');
    expect(parseReceipt('DEARBORN MUSIC\n22000 Michigan Ave\n10/01/2026\nGUITAR STRINGS 9.99', today).store).toBe('Dearborn Music');
    expect(parseReceipt('Hi Sam,\nHilltop Books\n10/01/2026\nNovel 12.99', today).store).toBe('Hilltop Books');
  });

  it('ignores promo "order on or before" lines', () => {
    const r = parseReceipt('CORNER HARDWARE\n10/01/2026\nHAMMER 19.99\nTOTAL 21.59\nOrder on or before Dec 15 for holiday delivery!', today);
    expect(r.date).toBe('2026-10-01');
  });
});
