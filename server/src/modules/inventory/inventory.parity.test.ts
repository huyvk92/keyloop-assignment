import {
  SCENARIO_TODAY,
  scenarioVin,
  VEHICLE_QUERY_SCENARIOS,
  type VehicleQueryScenario,
} from '@shared/api/vehicles.cases';
import {
  SUMMARY_SCENARIOS,
  type SummaryScenario,
  type SummaryScenarioVehicle,
} from '@shared/api/summary.cases';
import { InventorySummarySchema, VehicleListResponseSchema } from '@shared/api/vehicles';
import type { Db } from '../../db/connection';
import { insertAction, insertDealership, insertVehicle } from '../../../test/factories';
import { createTestApp } from '../../../test/helpers';

/**
 * One dealership holding the scenario's vehicles (ages relative to SCENARIO_TODAY). A vehicle gets
 * `actionCount` actions (default 1 when `hasAction`), logged a minute apart. One transaction, so
 * the 2,001-vehicle rows stay fast.
 */
function insertScenarioStock(db: Db, vehicles: SummaryScenarioVehicle[]): number {
  const dealershipId = insertDealership(db);
  const insertAll = db.transaction(() => {
    vehicles.forEach((v, index) => {
      const vehicleId = insertVehicle(db, {
        dealershipId,
        today: SCENARIO_TODAY,
        ageDays: v.ageDays,
        make: v.make,
        model: v.model,
        stockNumber: v.stockNumber,
        vin: v.vin ?? scenarioVin(index),
        listPriceMinor: v.priceMinor,
      });
      const actions = v.actionCount ?? (v.hasAction ? 1 : 0);
      for (let n = 0; n < actions; n++) {
        const loggedAt = `${SCENARIO_TODAY}T09:${String(n).padStart(2, '0')}:00.000Z`;
        insertAction(db, { vehicleId, loggedAt });
      }
    });
  });
  insertAll();
  return dealershipId;
}

/**
 * API side of the MSW parity guard: the same scenario table runs against the mock in
 * src/mocks/vehicle-query.test.ts. The API is the source of truth.
 */
describe('vehicle list scenarios (API side of the MSW parity table)', () => {
  it.each(VEHICLE_QUERY_SCENARIOS.map((s) => [s.name, s] as const))(
    '%s',
    async (_name, scenario: VehicleQueryScenario) => {
      const ctx = await createTestApp({ today: SCENARIO_TODAY });
      try {
        const dealershipId = insertScenarioStock(ctx.db, scenario.vehicles);

        const response = await ctx.app.inject({
          method: 'GET',
          url: `/api/dealerships/${dealershipId}/vehicles?${scenario.query}`,
        });

        expect(response.statusCode).toBe(200);
        const body = VehicleListResponseSchema.parse(response.json());
        expect(body.items.map((item) => item.stockNumber)).toEqual(scenario.expected);
        expect(body.total).toBe(scenario.expected.length);
      } finally {
        await ctx.close();
      }
    },
  );
});

/**
 * API side of the summary parity table; the mock side is src/mocks/summary-query.test.ts. Every
 * row runs here, including the `serverOnly` ones the mock side skips.
 */
describe('summary scenarios (API side of the MSW parity table)', () => {
  it.each(
    SUMMARY_SCENARIOS.map((s) => [s.serverOnly ? `[server-only] ${s.name}` : s.name, s] as const),
  )('%s', async (_name, scenario: SummaryScenario) => {
    const ctx = await createTestApp({ today: SCENARIO_TODAY });
    try {
      const dealershipId = insertScenarioStock(ctx.db, scenario.vehicles);

      const response = await ctx.app.inject({
        method: 'GET',
        url: `/api/dealerships/${dealershipId}/summary`,
      });

      expect(response.statusCode).toBe(200);
      expect(InventorySummarySchema.parse(response.json())).toEqual({
        asOfDate: SCENARIO_TODAY,
        ...scenario.expected,
      });
    } finally {
      await ctx.close();
    }
  });
});
