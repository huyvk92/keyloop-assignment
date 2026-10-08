import { SUMMARY_SCENARIOS, type SummaryScenario } from '@shared/api/summary.cases';
import { SCENARIO_TODAY, scenarioVin } from '@shared/api/vehicles.cases';
import { buildCurrentAction, buildVehicle } from '@/mocks/fixtures';
import { summarizeVehicles } from '@/mocks/summary-query';

/**
 * Mock side of the summary parity guard: the same scenario table runs against the real API in
 * server/src/modules/inventory/inventory.parity.test.ts. When a row fails only here, the mock is
 * wrong (the API is the source of truth).
 */
const SHARED_ROWS = SUMMARY_SCENARIOS.filter((s) => !s.serverOnly);
const SERVER_ONLY_ROWS = SUMMARY_SCENARIOS.filter((s) => s.serverOnly);

describe('summary scenarios (MSW side of the API parity table)', () => {
  it('marks every row with a future-dated vehicle as server-only (the mock has no date logic)', () => {
    expect(SHARED_ROWS.flatMap((s) => s.vehicles).every((v) => v.ageDays >= 0)).toBe(true);
  });

  it.each(SHARED_ROWS.map((s) => [s.name, s] as const))(
    '%s',
    (_name, scenario: SummaryScenario) => {
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

      expect(summarizeVehicles(vehicles, SCENARIO_TODAY)).toEqual({
        asOfDate: SCENARIO_TODAY,
        ...scenario.expected,
      });
    },
  );

  // Clamping a future stock-in date (BR-01) happens before the mock sees `daysInStock`, so these
  // rows would only test this harness. inventory.parity.test.ts runs them against the API.
  it.skip.each(SERVER_ONLY_ROWS.map((s) => [s.name] as const))(
    '[server-only, verified by inventory.parity.test.ts] %s',
    () => {},
  );
});
