import { VehicleListQuerySchema } from '@shared/api/vehicles';
import {
  SCENARIO_TODAY,
  scenarioVin,
  VEHICLE_QUERY_SCENARIOS,
  type VehicleQueryScenario,
} from '@shared/api/vehicles.cases';
import { buildCurrentAction, buildVehicle, FIXTURE_TODAY } from '@/mocks/fixtures';
import { queryVehicles } from '@/mocks/vehicle-query';

/**
 * Mock side of the MSW parity guard: the same scenario table runs against the real API in
 * server/src/modules/inventory/inventory.parity.test.ts. When a row fails only here, the mock is
 * wrong (the API is the source of truth).
 */
describe('vehicle list scenarios (MSW side of the API parity table)', () => {
  it('uses the same "today" as the API scenarios', () => {
    expect(FIXTURE_TODAY).toBe(SCENARIO_TODAY);
  });

  it.each(VEHICLE_QUERY_SCENARIOS.map((s) => [s.name, s] as const))(
    '%s',
    (_name, scenario: VehicleQueryScenario) => {
      const vehicles = scenario.vehicles.map((v, index) =>
        buildVehicle({
          id: index + 1,
          daysInStock: v.ageDays,
          make: v.make,
          model: v.model,
          stockNumber: v.stockNumber,
          vin: v.vin ?? scenarioVin(index),
          listPriceMinor: v.priceMinor,
          currentAction: v.hasAction ? buildCurrentAction() : null,
        }),
      );
      const query = VehicleListQuerySchema.parse(
        Object.fromEntries(new URLSearchParams(scenario.query)),
      );

      const result = queryVehicles(vehicles, query).slice(0, query.pageSize);

      expect(result.map((v) => v.stockNumber)).toEqual(scenario.expected);
    },
  );
});
