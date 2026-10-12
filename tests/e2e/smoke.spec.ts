import { expect, test, type Page } from '@playwright/test';

function watch(page: Page) {
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && !['blob:', 'data:'].includes(u.protocol)) foreign.push(r.url());
  });
  return { errors, foreign };
}

test('onboarding → scan sample receipt (on-device OCR) → review → card → Coming Up', async ({ page }) => {
  const w = watch(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Not now|Continue/ }).first().click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { name: 'Snap a receipt once' })).toBeVisible();

  await page.getByRole('button', { name: 'Scan a receipt' }).first().click();
  await page.getByRole('button', { name: 'Sample receipt' }).click();
  await expect(page).toHaveURL(/#\/review/, { timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Check these details' })).toBeVisible();

  // The text reader found the store, total and items.
  await expect(page.getByPlaceholder('Where from?')).toHaveValue('Target');
  await expect(page.getByLabel('Total', { exact: true })).toHaveValue('135.92');
  await expect(page.getByLabel('Item 1', { exact: true })).toHaveValue(/Headphones/i);
  await expect(page.getByLabel('Return by', { exact: true })).not.toHaveValue('');

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/#\/card\//);
  await expect(page.getByText('Return by')).toBeVisible();
  await expect(page.getByRole('button', { name: 'I returned it' })).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('list', { name: 'Later' })).toBeVisible();

  expect(w.errors).toEqual([]);
  // Receipts never leave the device: no request to any other origin.
  expect(w.foreign).toEqual([]);
});

test('quick add → wallet → use coupon → savings; search; sample data', async ({ page }) => {
  const w = watch(page);
  await page.addInitScript(() => localStorage.setItem('kept:settings', JSON.stringify({ onboarded: true })));
  await page.goto('/');

  await page.getByRole('button', { name: 'Scan a receipt' }).first().click();
  await page.getByLabel('Quick add').fill("$10 coupon at Kohl's expires in 3 days");
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Coupon' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByPlaceholder('Where from?')).toHaveValue("Kohl's");
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('3 days left')).toBeVisible();

  await page.getByRole('button', { name: 'I used it' }).click();
  await page.getByRole('button', { name: 'Mark as used' }).click();
  await expect(page.getByText('Saved $10.00')).toBeVisible();

  await page.goto('/#/savings');
  await expect(page.getByText('$10.00').first()).toBeVisible();

  await page.goto('/#/settings');
  await page.getByRole('button', { name: /Add sample cards/ }).click();
  await page.goto('/#/');
  await expect(page.getByRole('list', { name: 'This week' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Return by .*Boots at Target/ })).toBeVisible();

  await page.goto('/#/receipts');
  await page.getByLabel('Search receipts').fill('laptop');
  await expect(page.getByRole('list', { name: '1 result' })).toBeVisible();

  await page.goto('/#/wallet');
  await expect(page.getByRole('list', { name: 'Starbucks' })).toBeVisible();

  expect(w.errors).toEqual([]);
  expect(w.foreign).toEqual([]);
});

test('paste an order email → review with delivery-based return date', async ({ page }) => {
  const w = watch(page);
  await page.addInitScript(() => localStorage.setItem('kept:settings', JSON.stringify({ onboarded: true })));
  await page.goto('/#/scan');
  await page.getByRole('button', { name: /Paste an order email/ }).click();
  // Dates relative to today so the test keeps working: ordered 6 days ago, delivered 3 days ago.
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  };
  const words = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await page.getByLabel('Order email text').fill(
    [
      'Amazon.com',
      'Hello Sam,',
      `Ordered on ${words(day(-6))}`,
      `Delivered ${words(day(-3))}`,
      'Order # 112-1234567',
      'Dyson V8 Cordless Vacuum',
      'Qty: 1',
      '$349.99',
      'Order Total: $349.99',
      'Get $10 off your next order with promo code SAVE10',
    ].join('\n'),
  );
  // Typing must keep focus in the box (it used to lose it after every key).
  await page.getByLabel('Order email text').press('End');
  await page.getByLabel('Order email text').pressSequentially('\nThanks!');
  await expect(page.getByLabel('Order email text')).toHaveValue(/Thanks!$/);
  await page.getByRole('button', { name: 'Read it' }).click();
  await expect(page).toHaveURL(/#\/review/);
  await expect(page.getByRole('radio', { name: 'Purchase' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByPlaceholder('Where from?')).toHaveValue('Amazon');
  await expect(page.getByLabel('Total', { exact: true })).toHaveValue('349.99');
  await expect(page.getByLabel('Delivery date', { exact: true })).toHaveValue(iso(day(-3)));
  // Amazon: 30 days from delivery.
  await expect(page.getByLabel('Return by', { exact: true })).toHaveValue(iso(day(27)));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/#\/card\//);
  expect(w.errors).toEqual([]);
  expect(w.foreign).toEqual([]);
});

test('weekly check-in: decide on returns from Coming Up', async ({ page }) => {
  const w = watch(page);
  await page.addInitScript(() => localStorage.setItem('kept:settings', JSON.stringify({ onboarded: true })));
  await page.goto('/#/settings');
  await page.getByRole('button', { name: /Add sample cards/ }).click();
  await expect(page.getByRole('radiogroup', { name: 'Skip reminders for buys under' })).toBeVisible();
  await page.goto('/#/');
  await page.getByRole('button', { name: /Weekly check-in/ }).click();
  await expect(page).toHaveURL(/#\/checkin/);
  const boots = page.getByRole('group', { name: 'Decide on Boots' });
  await boots.getByRole('button', { name: 'Keep it' }).click();
  await expect(page.getByText('Keeping it', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('group', { name: 'Decide on Boots' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('button', { name: /Weekly check-in/ })).toHaveCount(0);
  expect(w.errors).toEqual([]);
  expect(w.foreign).toEqual([]);
});

test('returns start to finish, price check, trial, store page', async ({ page }) => {
  const w = watch(page);
  await page.addInitScript(() => localStorage.setItem('kept:settings', JSON.stringify({ onboarded: true })));
  await page.goto('/#/settings');
  await page.getByRole('button', { name: /Add sample cards/ }).click();

  // A mailed return: drop it off → refund check.
  await page.goto('/#/receipts');
  await page.getByLabel('Search receipts').fill('running shoes');
  await page.getByRole('button', { name: /Running shoes/ }).click();
  await expect(page.getByText('Drop it off by')).toBeVisible();
  await page.getByRole('button', { name: 'Dropped it off' }).click();
  await expect(page.getByText('Refund on its way')).toBeVisible();

  // Start a return from an open purchase.
  await page.goto('/#/receipts');
  await page.getByLabel('Search receipts').fill('boots');
  await page.getByRole('button', { name: /Boots/ }).click();
  await page.getByRole('button', { name: 'Return it', exact: true }).click();
  await page.getByRole('button', { name: /Taking it back to the store/ }).click();
  await expect(page.getByText('Take it back by')).toBeVisible();

  // Price-drop check on a big Best Buy purchase.
  await page.goto('/#/receipts');
  await page.getByLabel('Search receipts').fill('tv');
  await page.getByRole('button', { name: /55" TV/ }).click();
  await expect(page.getByText('Price-drop refund until')).toBeVisible();
  await expect(page.getByRole('link', { name: /Check the price/ })).toHaveAttribute('href', /bestbuy\.com/);
  await page.getByRole('button', { name: 'No drop' }).click();
  await expect(page.getByText('Price-drop refund until')).toHaveCount(0);

  // A trial from a sentence → cancel → Savings.
  await page.goto('/#/scan');
  await page.getByLabel('Quick add').fill('Hulu trial ends in 5 days $9.99');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Trial or subscription' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Trial ends')).toBeVisible();
  await page.getByRole('button', { name: 'I cancelled it' }).click();
  await page.getByRole('button', { name: 'Mark as cancelled' }).click();
  await expect(page.getByText('Saved $9.99')).toBeVisible();

  // Everything at one store, with the code big for the cashier.
  await page.goto('/#/wallet');
  await page.getByRole('button', { name: "Everything at Kohl's" }).click();
  await expect(page).toHaveURL(/#\/store\//);
  await page.getByRole('button', { name: /Show/ }).first().click();
  await expect(page.getByRole('dialog', { name: /Kohl's/ })).toBeVisible();
  await expect(page.getByLabel('Code SAVE10NOW')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  expect(w.errors).toEqual([]);
  expect(w.foreign).toEqual([]);
});
