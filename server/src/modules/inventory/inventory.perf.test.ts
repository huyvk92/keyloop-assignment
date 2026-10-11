import { performance } from 'node:perf_hooks';
import {
  FacetsResponseSchema,
  InventorySummarySchema,
  VehicleListResponseSchema,
} from '@shared/api/vehicles';
import { insertDealership } from '../../../test/factories';
import { createTestApp } from '../../../test/helpers';
import { addDays } from '../../lib/dates';

/**
 * Perf smoke (NFR, TRD §6 / T-015): 5,000 vehicles in one dealership, in-memory SQLite.
 * Runs only via `npm run test:perf` (vitest.perf.config.ts): alone, serially, without coverage,
 * and excluded from the coverage run, where parallel workers and instrumentation made it flaky.
 * Actual timings are attached to the test as annotations.
 */
const TODAY = '2026-10-07';
const VEHICLES = 5_000;
/**
 * Warm = steady state, held to the T-015 target of 200 ms per request. Cold = first request
 * after startup (statement preparation, page cache), which pays a one-off cost, so it gets a
 * looser 750 ms (still inside NFR-02's 1 s user-visible limit).
 */
const COLD_BUDGET_MS = 750;
const WARM_BUDGET_MS = 200;
const MAKES = [
  ['Ford', ['Fiesta', 'Focus', 'Puma', 'Kuga']],
  ['Toyota', ['Yaris', 'Corolla', 'RAV4']],
  ['Kia', ['Picanto', 'Sportage', 'Niro']],
  ['BMW', ['1 Series', '3 Series', 'X1']],
  ['Volkswagen', ['Polo', 'Golf', 'Tiguan']],
] as const;

type TestApp = Awaited<ReturnType<typeof createTestApp>>;
let ctx: TestApp;
let dealershipId: number;

/**
 * Bulk insert: one transaction, two statements prepared once (the per-row factories re-prepare
 * on every call, which made this hook time out under load). The explicit hook timeout is a
 * safety margin for a busy machine; it does not affect the per-request budget below.
 */
beforeAll(async () => {
  ctx = await createTestApp({ today: TODAY });
  dealershipId = insertDealership(ctx.db, { name: 'Perf Motors' });
  const insertVehicle = ctx.db.prepare(
    `INSERT INTO vehicles (dealership_id, vin, stock_number, make, model, model_year, trim_level,
       colour, mileage, list_price_minor, stock_in_date)
     VALUES (?, ?, ?, ?, ?, 2022, 'Titanium', 'Blue', 12345, ?, ?)`,
  );
  const insertAction = ctx.db.prepare(
    `INSERT INTO vehicle_actions (vehicle_id, status, logged_by, logged_at)
     VALUES (?, 'Under Review', 'Jane Smith', '2026-10-07T09:00:00.000Z')`,
  );
  ctx.db.transaction(() => {
    for (let i = 0; i < VEHICLES; i++) {
      const [make, models] = MAKES[i % MAKES.length]!;
      const { lastInsertRowid } = insertVehicle.run(
        dealershipId,
        `PERFVIN${String(i).padStart(10, '0')}`,
        `STK-${String(i).padStart(5, '0')}`,
        make,
        models[i % models.length]!,
        500_000 + ((i * 7919) % 5_000_000),
        addDays(TODAY, -((i * 7) % 400)),
      );
      if (i % 3 === 0) insertAction.run(lastInsertRowid);
    }
  })();
}, 60_000);
afterAll(() => ctx.close());

async function timedGet(path: string) {
  const start = performance.now();
  const response = await ctx.app.inject({
    method: 'GET',
    url: `/api/dealerships/${dealershipId}${path}`,
  });
  const ms = performance.now() - start;
  expect(response.statusCode).toBe(200);
  return { ms, json: response.json() as unknown };
}

async function timedList(query: string) {
  const { ms, json } = await timedGet(`/vehicles${query}`);
  return { ms, body: VehicleListResponseSchema.parse(json) };
}

describe(`vehicles list with ${VEHICLES} vehicles (perf smoke)`, () => {
  it.for<[label: string, query: string]>([
    ['default list (age desc)', ''],
    ['make + over-90 sorted by price', '?make=Ford&ageBucket=over-90&sort=price&order=desc'],
    ['search (leading-wildcard LIKE)', '?q=stk-01'],
    ['needs attention, make/model sort', '?needsAttention=true&sort=makeModel'],
    ['make/model sort (NOCASE), deep page', '?sort=makeModel&page=150'],
  ])('%s stays within budget', async ([label, query], { annotate }) => {
    const cold = await timedList(query);
    const warm = await timedList(query);

    await annotate(`${label}: cold ${cold.ms.toFixed(1)} ms, warm ${warm.ms.toFixed(1)} ms`);
    expect(cold.body.total).toBeGreaterThan(0);
    expect(cold.ms).toBeLessThan(COLD_BUDGET_MS);
    expect(warm.ms).toBeLessThan(WARM_BUDGET_MS);
  });

  it('facets stay within budget', async ({ annotate }) => {
    const cold = await timedGet('/facets');
    const warm = await timedGet('/facets');

    await annotate(`facets: cold ${cold.ms.toFixed(1)} ms, warm ${warm.ms.toFixed(1)} ms`);
    const facets = FacetsResponseSchema.parse(cold.json);
    expect(facets.makes.map((m) => m.make)).toEqual(['BMW', 'Ford', 'Kia', 'Toyota', 'Volkswagen']);
    expect(cold.ms).toBeLessThan(COLD_BUDGET_MS);
    expect(warm.ms).toBeLessThan(WARM_BUDGET_MS);
  });

  it('summary stays within budget and matches the list totals', async ({ annotate }) => {
    const cold = await timedGet('/summary');
    const warm = await timedGet('/summary');

    await annotate(`summary: cold ${cold.ms.toFixed(1)} ms, warm ${warm.ms.toFixed(1)} ms`);
    const summary = InventorySummarySchema.parse(cold.json);
    expect(summary.totalVehicles).toBe(VEHICLES);
    expect(summary.agingCount).toBe((await timedList('?agingOnly=true')).body.total);
    expect(summary.needsAttentionCount).toBe((await timedList('?needsAttention=true')).body.total);
    expect(cold.ms).toBeLessThan(COLD_BUDGET_MS);
    expect(warm.ms).toBeLessThan(WARM_BUDGET_MS);
  });
});
