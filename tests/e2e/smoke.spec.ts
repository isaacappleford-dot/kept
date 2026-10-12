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
