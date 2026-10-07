import {
  SCENARIO_TODAY,
  scenarioVin,
  VEHICLE_QUERY_SCENARIOS,
  type VehicleQueryScenario,
} from '@shared/api/vehicles.cases';
import { VehicleListResponseSchema } from '@shared/api/vehicles';
import { insertAction, insertDealership, insertVehicle } from '../../../test/factories';
import { createTestApp } from '../../../test/helpers';

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
        const dealershipId = insertDealership(ctx.db);
        scenario.vehicles.forEach((v, index) => {
          const vehicleId = insertVehicle(ctx.db, {
            dealershipId,
            today: SCENARIO_TODAY,
            ageDays: v.ageDays,
            make: v.make,
            model: v.model,
            stockNumber: v.stockNumber,
            vin: v.vin ?? scenarioVin(index),
            listPriceMinor: v.priceMinor,
          });
          if (v.hasAction) insertAction(ctx.db, { vehicleId });
        });

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
