import { expect, test } from '@playwright/test';
import {
  DEALERSHIPS,
  dealershipHeading,
  selectFilters,
  vehicleRow,
  vehicleTable,
} from './support/dashboard';

/**
 * Critical journey (T-042 plan 1): filter to aging Fords, log an action on the oldest, reload.
 * Covers AC-002.7 (filters survive a reload), AC-006.3 (confirmation, history, list update without
 * a refresh) and AC-007.1 (the action survives a reload). AC-007.3 (server restart) is covered by
 * the API restart test, not here.
 *
 * The only spec that writes: it logs on Birmingham's STK-1078, which no other spec reads. The
 * "Logged by" name is unique to this spec, so the assertions can't pass on seeded data.
 */
const { birmingham } = DEALERSHIPS;
const OLDEST = { view: 'View STK-1078', dialog: 'STK-1078 · Ford Fiesta', days: '282' };
const LOGGED_BY = 'E2E Journey Tester';
const NOTE = 'Reduce by 5%';

test('filter aging Fords, log an action on the oldest, and keep both after a reload', async ({
  page,
}) => {
  // "/" opens the alphabetically first dealership.
  await page.goto('/');
  await expect(page).toHaveURL(new RegExp(`/dealerships/${birmingham.id}$`));
  await expect(dealershipHeading(page, birmingham)).toBeVisible();

  await selectFilters(page);
  await expect(page).toHaveURL(/[?&]make=Ford(&|$)/);
  await expect(page).toHaveURL(/[?&]ageBucket=over-90(&|$)/);
  await expect(page.getByText('5 vehicles match your filters')).toBeVisible();

  // The default sort is days in stock, oldest first, so the first data row is the oldest.
  const table = vehicleTable(page, birmingham);
  await expect(table.getByRole('columnheader', { name: 'Days in stock' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  const firstRow = table.getByRole('row').nth(1);
  await expect(firstRow.getByRole('button', { name: OLDEST.view })).toBeVisible();
  await expect(firstRow).toContainText(OLDEST.days);
  await firstRow.getByRole('button', { name: OLDEST.view }).click();

  const dialog = page.getByRole('dialog', { name: OLDEST.dialog });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: 'Price Reduction Planned' }).check();
  await dialog.getByRole('textbox', { name: 'Note (optional)' }).fill(NOTE);
  await dialog.getByRole('textbox', { name: 'Logged by' }).fill(LOGGED_BY);
  await dialog.getByRole('button', { name: 'Save action' }).click();

  // AC-006.3: confirmation, new top history entry, and the list row updated without a refresh.
  await expect(dialog.getByRole('status')).toHaveText('Action saved');
  const latest = dialog
    .getByRole('list', { name: 'Action history, newest first' })
    .getByRole('listitem')
    .first();
  await expect(latest).toContainText('Price Reduction Planned');
  await expect(latest).toContainText(NOTE);
  await expect(latest).toContainText(`Logged by ${LOGGED_BY}`);
  await expect(vehicleRow(table, OLDEST.view)).toContainText(LOGGED_BY);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // AC-002.7 + AC-007.1: after a reload the filters and the saved action are still there.
  await page.reload();
  await expect(page).toHaveURL(/[?&]make=Ford(&|$)/);
  await expect(page).toHaveURL(/[?&]ageBucket=over-90(&|$)/);
  await expect(page.getByRole('combobox', { name: 'Make' })).toHaveValue('Ford');
  await expect(page.getByRole('combobox', { name: 'Days in stock' })).toHaveValue('over-90');
  await expect(page.getByText('5 vehicles match your filters')).toBeVisible();

  const row = vehicleRow(table, OLDEST.view);
  await expect(row).toContainText('Price Reduction Planned');
  await expect(row).toContainText(LOGGED_BY);

  await row.getByRole('button', { name: OLDEST.view }).click();
  const reopened = page
    .getByRole('dialog', { name: OLDEST.dialog })
    .getByRole('list', { name: 'Action history, newest first' })
    .getByRole('listitem')
    .first();
  await expect(reopened).toContainText(NOTE);
  await expect(reopened).toContainText(`Logged by ${LOGGED_BY}`);
});
