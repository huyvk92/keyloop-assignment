import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { DEALERSHIPS, dealershipHeading, selectFilters, selectLanguage } from './support/dashboard';

/**
 * CSV export (T-044, US-013) against the real API and seed (APP_TODAY=2026-10-07): the browser
 * fetches every page of the filtered list and saves the file (ADR-010). Read-only: no spec
 * changes Ford over-90 membership at Birmingham (the journey spec's action keeps STK-1078 in it).
 */
const { birmingham } = DEALERSHIPS;
const FILE_NAME = 'inventory-birmingham-central-motors-2026-10-07.csv';
const COLUMN = { make: 2, listPrice: 8, daysInStock: 11 } as const;

/** Minimal RFC 4180 reader for the assertions (quoted fields, doubled quotes, CRLF records). */
function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\r' && text[index + 1] === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      index++;
    } else {
      field += char;
    }
  }
  return records;
}

/** Clicks the export button and returns the saved file's name and bytes. */
async function exportCsv(page: Page, buttonName: string) {
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: buttonName }).click();
  const download = await downloaded;
  const path = await download.path();
  return { fileName: download.suggestedFilename(), bytes: await readFile(path) };
}

async function openFordOver90(page: Page) {
  await page.goto(`/dealerships/${birmingham.id}`);
  await expect(dealershipHeading(page, birmingham)).toBeVisible();
  await selectFilters(page);
  await expect(page.getByText('5 vehicles match your filters')).toBeVisible();
}

test('exports the filtered list (Ford, over 90 days) as a CSV file (AC-013.1)', async ({
  page,
}) => {
  await openFordOver90(page);

  const { fileName, bytes } = await exportCsv(page, 'Export CSV');

  expect(fileName).toBe(FILE_NAME);
  // UTF-8 byte-order mark, then CRLF records (AC-013.3, RFC 4180).
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const text = bytes.subarray(3).toString('utf8');
  expect(text.endsWith('\r\n')).toBe(true);

  const [header, ...rows] = parseCsv(text);
  expect(header).toEqual([
    'Stock no.',
    'VIN',
    'Make',
    'Model',
    'Year',
    'Trim',
    'Colour',
    'Mileage (mi)',
    'List price',
    'Currency',
    'Stock-in date',
    'Days in stock',
    'Aging',
    'Needs attention',
    'Current action',
    'Logged by',
    'Logged at (UTC)',
  ]);
  expect(rows).toHaveLength(5);
  const days = rows.map((row) => Number(row[COLUMN.daysInStock]));
  for (const row of rows) {
    expect(row).toHaveLength(header?.length ?? 0);
    expect(row[COLUMN.make]).toBe('Ford');
  }
  expect(days.every((value) => value > 90)).toBe(true);
  // The list's default sort: days in stock, oldest first.
  expect(days).toEqual([...days].sort((a, b) => b - a));
  await expect(page.getByRole('button', { name: 'Export CSV' })).not.toHaveAttribute(
    'aria-disabled',
  );
});

test('exports Vietnamese headings with the data as stored (AC-013.3)', async ({ page }) => {
  await openFordOver90(page);
  await selectLanguage(page, 'Tiếng Việt');

  const { fileName, bytes } = await exportCsv(page, 'Xuất CSV');

  expect(fileName).toBe(FILE_NAME);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const [header, ...rows] = parseCsv(bytes.subarray(3).toString('utf8'));
  expect(header?.slice(0, 5)).toEqual(['Mã tồn kho', 'Số VIN', 'Hãng xe', 'Mẫu xe', 'Đời xe']);
  expect(header?.[COLUMN.daysInStock]).toBe('Số ngày tồn kho');
  expect(rows).toHaveLength(5);
  for (const row of rows) {
    expect(row[COLUMN.make]).toBe('Ford');
    expect(row[12]).toBe('Có');
  }
});

test('exports every page of an unfiltered list in sort order (ADR-010)', async ({ page }) => {
  const pageRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/vehicles') && url.searchParams.get('pageSize') === '100') {
      pageRequests.push(url.searchParams.get('page') ?? '');
    }
  });
  await page.goto(`/dealerships/${birmingham.id}?sort=price`);
  await expect(page.getByText('360 vehicles in stock')).toBeVisible();

  const { bytes } = await exportCsv(page, 'Export CSV');

  const [, ...rows] = parseCsv(bytes.subarray(3).toString('utf8'));
  expect(rows).toHaveLength(360);
  expect(new Set(rows.map((row) => row[0])).size).toBe(360);
  // Price ascending across page boundaries, as plain major-unit decimals.
  const prices = rows.map((row) => row[COLUMN.listPrice] ?? '');
  expect(prices.every((price) => /^\d+\.\d{2}$/.test(price))).toBe(true);
  const values = prices.map(Number);
  expect(values).toEqual([...values].sort((a, b) => a - b));
  expect(pageRequests.sort()).toEqual(['1', '2', '3', '4']);
});
