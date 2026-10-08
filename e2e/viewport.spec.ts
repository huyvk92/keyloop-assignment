import { expect, test, type Page } from '@playwright/test';
import { DEALERSHIPS, dealershipHeading, selectLanguage, vehicleTable } from './support/dashboard';

/**
 * AC-005.4: at 1280x800 the KPI summary, including the aging count, is visible without
 * scrolling. Until T-042 this was evidenced by screenshots only (SYSTEM_DESIGN §8.6).
 */
const KPI = {
  en: { region: 'Inventory summary', total: 'Total vehicles' },
  vi: { region: 'Tổng quan tồn kho', total: 'Tổng số xe' },
} as const;

const { birmingham } = DEALERSHIPS;

/** Opens Birmingham in a language and waits until the KPIs and the list have data. */
async function openSummary(page: Page, language: keyof typeof KPI) {
  await page.goto(`/dealerships/${birmingham.id}`);
  await expect(dealershipHeading(page, birmingham)).toBeVisible();
  if (language === 'vi') await selectLanguage(page, 'Tiếng Việt');
  const region = page.getByRole('region', { name: KPI[language].region });
  await expect(region.getByLabel(KPI[language].total, { exact: true })).toHaveText('360');
  await expect(vehicleTable(page, birmingham).getByRole('row').nth(1)).toBeVisible();
  return region;
}

for (const language of ['en', 'vi'] as const) {
  test(`KPI summary is fully visible without scrolling at 1280x800 (${language})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const region = await openSummary(page, language);

    const box = await region.boundingBox();
    expect(box, 'the KPI region is rendered').not.toBeNull();
    const bottom = (box?.y ?? Infinity) + (box?.height ?? 0);
    test.info().annotations.push({
      type: `AC-005.4 at 1280x800 (${language})`,
      description: `KPI region bottom at y=${Math.round(bottom)} of 800`,
    });
    expect(bottom).toBeLessThanOrEqual(800);

    const terms = region.getByRole('term');
    const values = region.getByRole('definition');
    await expect(terms).toHaveCount(5);
    await expect(values).toHaveCount(5);
    for (let index = 0; index < 5; index++) {
      await expect(terms.nth(index)).toBeInViewport({ ratio: 1 });
      await expect(values.nth(index)).toBeInViewport({ ratio: 1 });
    }
  });
}

test('reports whether the KPI summary fits at 1024x768 (informational)', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  for (const language of ['en', 'vi'] as const) {
    const region = await openSummary(page, language);
    const box = await region.boundingBox();
    const bottom = box ? Math.round(box.y + box.height) : null;
    const fits = bottom !== null && bottom <= 768;
    // Reported, not asserted: AC-005.4 only specifies 1280x800.
    testInfo.annotations.push({
      type: `AC-005.4 at 1024x768 (${language})`,
      description: `${fits ? 'fits' : 'does not fit'}: KPI region bottom at y=${bottom ?? 'n/a'} of 768`,
    });
  }
});
