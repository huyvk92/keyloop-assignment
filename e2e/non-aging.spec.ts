import { expect, test } from '@playwright/test';
import { DEALERSHIPS, vehicleRow, vehicleTable } from './support/dashboard';

/**
 * AC-006.2 / BR-09 against the real clock pin (APP_TODAY=2026-10-07): a vehicle at exactly 90 days
 * is not aging, so its drawer shows the history but no "Log action" form. Read-only.
 */
const { leeds } = DEALERSHIPS;
const VIEW = 'View STK-1532';

test('a vehicle at exactly 90 days shows its history but no Log action form', async ({ page }) => {
  await page.goto(`/dealerships/${leeds.id}?minAge=90&maxAge=90`);

  const table = vehicleTable(page, leeds);
  await expect(page.getByText('1 vehicle matches your filters')).toBeVisible();
  const row = vehicleRow(table, VIEW);
  await expect(row).toContainText('90');
  await expect(row).toContainText('Not aging');

  await row.getByRole('button', { name: VIEW }).click();
  const dialog = page.getByRole('dialog', { name: 'STK-1532 · Audi A1' });

  // Wait for the loaded drawer before asserting what is absent.
  await expect(
    dialog.getByText('Actions can only be logged for vehicles in stock for more than 90 days.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Action history' })).toBeVisible();
  await expect(dialog.getByRole('radiogroup', { name: 'Action status' })).toHaveCount(0);
  await expect(dialog.getByRole('textbox', { name: 'Logged by' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Save action' })).toHaveCount(0);
});
