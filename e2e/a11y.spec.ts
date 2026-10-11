import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DEALERSHIPS, dealershipHeading, selectLanguage, vehicleTable } from './support/dashboard';

/**
 * NFR-01 (WCAG 2.1 AA) in a real browser: axe on the loaded dashboard in both languages and with
 * the vehicle drawer open. Complements eslint-plugin-jsx-a11y and the Storybook a11y addon, which
 * can't see the composed page. Read-only (Manchester).
 */
// axe analyses the whole composed page (25 rows, aging list, drawer): allow more than the 30 s default.
test.describe.configure({ timeout: 60_000 });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const { manchester } = DEALERSHIPS;

const axe = (page: Page) => new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

/** Opens Manchester and waits until every region shows data (no skeletons or spinners). */
async function openLoadedDashboard(page: Page) {
  await page.goto(`/dealerships/${manchester.id}`);
  await expect(dealershipHeading(page, manchester)).toBeVisible();
  await expect(page.getByLabel(/^(Total vehicles|Tổng số xe)$/)).toHaveText('150');
  await expect(page.getByRole('list', { name: /^(Aging vehicles|Xe tồn kho lâu),/ })).toBeVisible();
  await expect(vehicleTable(page, manchester).getByRole('row').nth(1)).toBeVisible();
}

test('dashboard has no WCAG 2.1 AA violations (English)', async ({ page }) => {
  await openLoadedDashboard(page);
  expect((await axe(page)).violations).toEqual([]);
});

test('dashboard has no WCAG 2.1 AA violations (Vietnamese)', async ({ page }) => {
  await openLoadedDashboard(page);
  await selectLanguage(page, 'Tiếng Việt');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('region', { name: 'Tổng quan tồn kho' })).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
});

test('vehicle drawer with the Log action form has no WCAG 2.1 AA violations', async ({ page }) => {
  await openLoadedDashboard(page);
  // Oldest first by default, so the first row is aging and its drawer has the form.
  await vehicleTable(page, manchester)
    .getByRole('button', { name: /^View STK-/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Save action' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Action history' })).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
});
