import { expect, test } from '@playwright/test';

/**
 * Regression guard for a bug this suite found: a second filter change made before React had
 * re-rendered the first URL dropped the first filter (`?ageBucket=over-90` without `make`).
 * Selecting through Playwright one control at a time leaves enough time for React to re-render
 * on an idle machine, so it cannot reproduce the race (verified by mutation). Both changes are
 * therefore dispatched in the same browser task, before any re-render can happen.
 */
test('keeps both filters when two changes happen before the page re-renders', async ({ page }) => {
  await page.goto('/dealerships/1');
  const make = page.getByRole('combobox', { name: 'Make' });
  const ageBucket = page.getByRole('combobox', { name: 'Days in stock' });
  await expect(make.getByRole('option', { name: 'Ford' })).toBeAttached();

  await page.evaluate(() => {
    const select = (label: string, value: string) => {
      const control = [...document.querySelectorAll('select')].find(
        (element) => element.labels?.[0]?.textContent?.trim() === label,
      );
      if (!control) throw new Error(`No select labelled ${label}`);
      control.value = value;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    };
    select('Make', 'Ford');
    select('Days in stock', 'over-90');
  });

  await expect(page).toHaveURL(/[?&]make=Ford(&|$)/);
  await expect(page).toHaveURL(/[?&]ageBucket=over-90(&|$)/);
  await expect(make).toHaveValue('Ford');
  await expect(ageBucket).toHaveValue('over-90');
});
