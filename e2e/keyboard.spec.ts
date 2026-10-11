import { expect, test } from '@playwright/test';
import { DEALERSHIPS, isFocused, vehicleTable } from './support/dashboard';

/**
 * NFR-01 / ADR-006 in a real browser (jsdom only stubs `showModal`): Tab reaches a row's View
 * button, Enter opens the drawer with focus on its heading, Escape closes it and returns focus to
 * the button. Read-only (Manchester).
 */
const { manchester } = DEALERSHIPS;
const VIEW = 'View STK-1640';
/** Generous upper bound on Tab presses from the top of the page to the first table row. */
const MAX_TABS = 100;

test('keyboard opens the drawer on its heading and Escape returns focus to View', async ({
  page,
}) => {
  await page.goto(`/dealerships/${manchester.id}?minAge=90&maxAge=90`);
  const viewButton = vehicleTable(page, manchester).getByRole('button', { name: VIEW });
  await expect(viewButton).toBeVisible();

  for (let presses = 0; presses < MAX_TABS && !(await isFocused(viewButton)); presses++) {
    await page.keyboard.press('Tab');
  }
  await expect(viewButton).toBeFocused();

  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'STK-1640 · Audi A1' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 2, name: 'STK-1640 · Audi A1' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(viewButton).toBeFocused();
});
