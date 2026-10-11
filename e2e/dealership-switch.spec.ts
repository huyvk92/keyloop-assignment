import { expect, test } from '@playwright/test';
import { DEALERSHIPS, dealershipHeading, selectFilters, vehicleTable } from './support/dashboard';

/**
 * T-042 plan 2, AC-008.2: switching dealership shows only the new dealership's data and resets the
 * filters; Back returns to the previous dealership with its filters (US-008). Read-only.
 */
const { birmingham, leeds } = DEALERSHIPS;

test('switching dealership resets the filters and Back restores them', async ({ page }) => {
  await page.goto(`/dealerships/${birmingham.id}`);
  await expect(dealershipHeading(page, birmingham)).toBeVisible();

  const make = page.getByRole('combobox', { name: 'Make' });
  const ageBucket = page.getByRole('combobox', { name: 'Days in stock' });
  const total = page
    .getByRole('region', { name: 'Inventory summary' })
    .getByLabel('Total vehicles', { exact: true });

  await selectFilters(page);
  await expect(page.getByText('5 vehicles match your filters')).toBeVisible();
  await expect(total).toHaveText('360');

  await page.getByRole('combobox', { name: 'Dealership' }).selectOption({ label: leeds.name });

  // Only Leeds: no search params left, filters empty, Leeds KPIs and list.
  await expect(page).toHaveURL(new RegExp(`/dealerships/${leeds.id}$`));
  await expect(dealershipHeading(page, leeds)).toBeVisible();
  await expect(make).toHaveValue('');
  await expect(ageBucket).toHaveValue('');
  await expect(total).toHaveText('220');
  await expect(page.getByText('220 vehicles in stock')).toBeVisible();
  await expect(vehicleTable(page, leeds)).toBeVisible();

  await page.goBack();

  await expect(page).toHaveURL(new RegExp(`/dealerships/${birmingham.id}\\?`));
  await expect(page).toHaveURL(/[?&]make=Ford(&|$)/);
  await expect(page).toHaveURL(/[?&]ageBucket=over-90(&|$)/);
  await expect(dealershipHeading(page, birmingham)).toBeVisible();
  await expect(make).toHaveValue('Ford');
  await expect(ageBucket).toHaveValue('over-90');
  await expect(page.getByText('5 vehicles match your filters')).toBeVisible();
  await expect(total).toHaveText('360');
});
