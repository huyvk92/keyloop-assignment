import { expect, test } from '@playwright/test';
import { DEALERSHIPS, selectLanguage, vehicleRow, vehicleTable } from './support/dashboard';

/**
 * US-015: AC-015.1 (English first, page language declared), AC-015.2 (switch in place, filters
 * kept), AC-015.3 (Vietnamese survives a reload), AC-015.5 (vehicle data and history shown as
 * stored, only the status label translated). Read-only; uses Leeds' seeded STK-1538.
 */
const { leeds } = DEALERSHIPS;
const VEHICLE_ID = 539;
const SEARCH = '?q=STK-1538';

type StoredVehicle = {
  make: string;
  model: string;
  colour: string;
  actions: { status: string; note: string | null; loggedBy: string }[];
};

test('Vietnamese survives a reload and vehicle data stays as stored', async ({ page, request }) => {
  // The stored values, read from the real API through the same proxy as the app.
  const response = await request.get(`/api/vehicles/${VEHICLE_ID}`);
  expect(response.ok()).toBe(true);
  const stored = (await response.json()) as StoredVehicle;
  const [latest] = stored.actions;
  expect(latest?.status).toBe('Price Reduction Planned');

  await page.goto(`/dealerships/${leeds.id}${SEARCH}`);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('region', { name: 'Inventory summary' })).toBeVisible();

  await selectLanguage(page, 'Tiếng Việt');
  await expect(html).toHaveAttribute('lang', 'vi');
  await expect(page).toHaveURL(new RegExp(`/dealerships/${leeds.id}\\${SEARCH}$`));

  await page.reload();

  await expect(html).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('combobox', { name: 'Ngôn ngữ' })).toHaveValue('vi');
  await expect(page.getByRole('region', { name: 'Tổng quan tồn kho' })).toBeVisible();
  // AC-015.2: the filters are kept across the switch and the reload.
  await expect(page.getByRole('searchbox', { name: 'Tìm kiếm' })).toHaveValue('STK-1538');

  const row = vehicleRow(vehicleTable(page, leeds), 'Xem STK-1538');
  await expect(row).toContainText(stored.make);
  await expect(row).toContainText(stored.model);
  await expect(row).toContainText('Dự kiến giảm giá');
  await expect(row).not.toContainText('Price Reduction Planned');
  await expect(row).toContainText(latest?.loggedBy ?? '');

  await row.getByRole('button', { name: 'Xem STK-1538' }).click();
  const dialog = page.getByRole('dialog', {
    name: `STK-1538 · ${stored.make} ${stored.model}`,
  });
  await expect(dialog).toContainText(stored.colour);
  const entry = dialog
    .getByRole('list', { name: 'Lịch sử hành động, mới nhất trước' })
    .getByRole('listitem')
    .first();
  await expect(entry).toContainText('Dự kiến giảm giá');
  await expect(entry).toContainText(`Người ghi nhận: ${latest?.loggedBy ?? ''}`);
  if (latest?.note) await expect(entry).toContainText(latest.note);
});
