import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quickAdd';
import { parseReceipt } from './parseReceipt';
import { draftFromQuickAdd, draftFromReceipt, withSuggestions } from './toDraft';

const today = '2026-10-11';

describe('drafts', () => {
  it('turns a parsed receipt into a purchase with suggested dates', () => {
    const text = 'BEST BUY\n10/01/2026\nAPPLE MACBOOK AIR 13  999.00\nTOTAL 1,079.00';
    const { draft: d } = draftFromReceipt(parseReceipt(text, today), text, today);
    expect(d.kind).toBe('purchase');
    expect(d.title).toBe('Apple Macbook Air 13');
    expect(d.total).toBe(107900);
    expect(d.returnBy).toBe('2026-10-16');
    expect(d.warrantyUntil).toBe('2027-10-01');
  });

  it('keeps dates from a quick-add sentence and suggests the rest', () => {
    const s = 'Got a vacuum at Target, 90-day return';
    const { draft, fixed } = draftFromQuickAdd(parseQuickAdd(s, today), s, today);
    expect(fixed).toEqual(['returnBy']);
    expect(draft.returnBy).toBe('2027-01-09');
    expect(draft.warrantyUntil).toBe('2027-10-11');
    // Changing the store later doesn't overwrite the spoken window.
    expect(withSuggestions({ ...draft, store: 'Best Buy' }, fixed).returnBy).toBe('2027-01-09');
  });

  it('makes wallet items with balance and expiry', () => {
    const s = '$25 store credit at Target, expires Dec 31';
    const { draft } = draftFromQuickAdd(parseQuickAdd(s, today), s, today);
    expect(draft.kind).toBe('credit');
    expect(draft.balance).toBe(2500);
    expect(draft.expires).toBe('2026-12-31');
    expect(draft.returnBy).toBeNull();
  });
});

describe('return dates from the receipt', () => {
  it('prefers an exact printed date and says so', () => {
    const text = 'CORNER HARDWARE\n10/01/2026\nHAMMER 19.99\nTOTAL 21.59\nRETURN BY: 10/31/2026';
    const r = draftFromReceipt(parseReceipt(text, today), text, today);
    expect(r.draft.returnBy).toBe('2026-10-31');
    expect(r.fixed).toEqual(['returnBy']);
    expect(r.returnNote).toBe('From your receipt.');
  });

  it('uses "within N days" only for stores it does not know', () => {
    const local = "Rosie's Boutique\n09/30/2026\nSilk Scarf 45.00\nTOTAL 45.00\nReturns accepted within 14 days with receipt.";
    const r = draftFromReceipt(parseReceipt(local, today), local, today);
    expect(r.draft.returnBy).toBe('2026-10-14');
    expect(r.returnNote).toBe('Your receipt says 14 days.');

    // Target's general "90 days" line must not override its 30-day electronics window.
    const target = 'TARGET\n10/01/2026\nSONY HEADPHONES 99.99\nTOTAL 99.99\nRETURNS WITHIN 90 DAYS';
    const t = draftFromReceipt(parseReceipt(target, today), target, today);
    expect(t.returnNote).toBeNull();
    expect(t.draft.returnBy).toBe('2026-10-31');
  });

  it('applies a remembered store window', () => {
    const text = 'TARGET\n10/01/2026\nTHROW PILLOW 24.99\nTOTAL 24.99';
    const r = draftFromReceipt(parseReceipt(text, today), text, today, { windows: { target: 60 } });
    expect(r.draft.returnBy).toBe('2026-11-30');
  });

  it('starts an online order’s clock at delivery', () => {
    const text = 'amazon.com\nOrder # 1\nOrdered on October 6, 2026\nDelivered October 9\nBoots\n$89.00\nOrder Total: $89.00';
    const r = draftFromReceipt(parseReceipt(text, today), text, today);
    expect(r.draft.deliveryDate).toBe('2026-10-09');
    expect(r.draft.returnBy).toBe('2026-11-08');
  });
});

describe('grocery stores and card perks', () => {
  it('treats grocery-store receipts as groceries unless items say otherwise', () => {
    const text = "TRADER JOE'S\n10/09/2026\nPASTA 2.99\nSALSA 3.49\nTOTAL 6.48";
    expect(draftFromReceipt(parseReceipt(text, today), text, today).draft.category).toBe('grocery');
    const tv = "KROGER\n10/09/2026\nROKU STREAMING STICK 39.99\nTOTAL 39.99";
    expect(draftFromReceipt(parseReceipt(tv, today), tv, today).draft.category).toBe('tv');
  });

  it('fills in the longer warranty from a credit card', () => {
    const text = 'BEST BUY\n10/01/2026\nAPPLE MACBOOK AIR 13  999.00\nTOTAL 1,079.00';
    const { draft } = draftFromReceipt(parseReceipt(text, today), text, today, { cardWarrantyMonths: 12 });
    expect(draft.warrantyUntil).toBe('2027-10-01');
    expect(draft.extendedWarrantyUntil).toBe('2028-10-01');
  });

  it('makes a trial from a sentence', () => {
    const s = 'Netflix trial ends Friday $15.49';
    const { draft } = draftFromQuickAdd(parseQuickAdd(s, today), s, today);
    expect(draft.kind).toBe('renewal');
    expect(draft.expires).toBe('2026-10-16');
    expect(draft.total).toBe(1549);
    expect(draft.returnBy).toBeNull();
  });
});
