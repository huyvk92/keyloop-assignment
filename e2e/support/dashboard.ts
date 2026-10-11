import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Seeded dealerships (server seed, ids by insertion). Each spec uses its own dealership or vehicle
 * where it matters, so the specs are independent of order: only the journey spec writes, and only
 * to Birmingham's STK-1078.
 */
export const DEALERSHIPS = {
  birmingham: { id: 1, name: 'Birmingham Central Motors' },
  leeds: { id: 2, name: 'Leeds Northside Cars' },
  manchester: { id: 3, name: 'Manchester Quays Autos' },
} as const;

type Dealership = (typeof DEALERSHIPS)[keyof typeof DEALERSHIPS];

/** The dashboard page heading (h1) of a dealership. */
export const dealershipHeading = (page: Page, dealership: Dealership) =>
  page.getByRole('heading', { level: 1, name: dealership.name });

/** The vehicle table, named by its caption ("Vehicles in stock at …" / "Xe tồn kho tại …"). */
export const vehicleTable = (page: Page, dealership: Dealership) =>
  page.getByRole('table', { name: new RegExp(`${dealership.name}$`) });

/** The table row of a vehicle, found through its "View <stock no.>" button. */
export const vehicleRow = (table: Locator, viewButtonName: string) =>
  table
    .getByRole('row')
    .filter({ has: table.page().getByRole('button', { name: viewButtonName }) });

/** Picks a UI language in the header switcher (labelled in the current language). */
export async function selectLanguage(page: Page, language: 'English' | 'Tiếng Việt') {
  await page
    .getByRole('combobox', { name: /^(Language|Ngôn ngữ)$/ })
    .selectOption({ label: language });
}

/** True when the element has keyboard focus (used to Tab until a control is reached). */
export const isFocused = (locator: Locator) =>
  locator.evaluate((element) => element === document.activeElement);

/**
 * Filters the list to Ford + "Over 90 days" through the filter bar, back to back with no wait in
 * between, like a user would. Not the regression guard for the lost-filter race: on an idle
 * machine React re-renders between two Playwright actions, so this passes even with the old bug
 * (checked by mutation). The guard is quick-filters.spec.ts, which dispatches both changes in one
 * browser task.
 */
export async function selectFilters(page: Page) {
  const make = page.getByRole('combobox', { name: 'Make' });
  const ageBucket = page.getByRole('combobox', { name: 'Days in stock' });
  await make.selectOption('Ford');
  await ageBucket.selectOption({ label: 'Over 90 days' });
  await expect(page).toHaveURL(/[?&]make=Ford(&|$)/);
  await expect(page).toHaveURL(/[?&]ageBucket=over-90(&|$)/);
  await expect(make).toHaveValue('Ford');
  await expect(ageBucket).toHaveValue('over-90');
}
