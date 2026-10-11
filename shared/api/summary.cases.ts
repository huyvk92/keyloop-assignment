/**
 * Shared inventory-summary scenarios (BR-15, BR-16, TA-21) run against BOTH the real API
 * (server/src/modules/inventory/inventory.parity.test.ts, SQLite) and the MSW mock
 * (src/mocks/summary-query.test.ts), so the KPI maths cannot drift apart. The server is the
 * source of truth: when a row fails only on the web side, fix the mock.
 *
 * Pure data: imports types only. Vehicles reuse the list scenario shape; a negative `ageDays` is
 * a future-dated stock-in date (age clamped to 0, BR-01). "Today" is SCENARIO_TODAY on both sides,
 * so every expected `asOfDate` is that date.
 *
 * `serverOnly` rows exercise logic the mock does not have: the mock receives `daysInStock`
 * already computed (no stock-in dates, so no clamping) and models only the current action (no
 * action history). Running those rows against the mock would only test the harness, so the web
 * side skips them (with a visible "[server-only]" title) and the server side runs every row.
 */
import type { InventorySummary } from './vehicles';
import type { ScenarioVehicle } from './vehicles.cases';

export type SummaryScenarioVehicle = ScenarioVehicle & {
  /** Logged actions; defaults to 1 when `hasAction`, else 0. Only the server stores history. */
  actionCount?: number;
};

export type SummaryScenario = {
  name: string;
  vehicles: SummaryScenarioVehicle[];
  expected: Omit<InventorySummary, 'asOfDate'>;
  /** Only the server can verify this row meaningfully (see the file comment). */
  serverOnly?: boolean;
};

const vehicle = (index: number, ageDays: number, actionCount = 0): SummaryScenarioVehicle => ({
  ageDays,
  make: 'Ford',
  model: 'Focus',
  stockNumber: `K-${String(index).padStart(4, '0')}`,
  priceMinor: 1_000_000,
  hasAction: actionCount > 0,
  actionCount,
});
const acted = (index: number, ageDays: number) => vehicle(index, ageDays, 1);
/** One vehicle per age, none with an action. */
const ofAges = (ages: number[]) => ages.map((age, index) => vehicle(index, age));
/** `aging` vehicles aged 91 days, then age-0 vehicles up to `total`; none with an action. */
const agingOf = (aging: number, total: number) =>
  ofAges(Array.from({ length: total }, (_, index) => (index < aging ? 91 : 0)));

export const SUMMARY_SCENARIOS: SummaryScenario[] = [
  {
    name: 'AC-005.1: ages 10..200 give 8 / 3 / 37.5% / 75 days (601 / 8 = 75.125)',
    vehicles: ofAges([10, 20, 30, 40, 90, 91, 120, 200]),
    expected: {
      totalVehicles: 8,
      agingCount: 3,
      agingPercent: 37.5,
      averageDaysInStock: 75,
      needsAttentionCount: 3,
    },
  },
  {
    name: 'AC-005.3: no vehicles give 0 / 0 / 0% / null',
    vehicles: [],
    expected: {
      totalVehicles: 0,
      agingCount: 0,
      agingPercent: 0,
      averageDaysInStock: null,
      needsAttentionCount: 0,
    },
  },
  {
    name: 'AC-010.1: 3 aging, 2 with an action, give needsAttentionCount 1',
    vehicles: [acted(0, 91), acted(1, 120), vehicle(2, 200), vehicle(3, 30)],
    expected: {
      totalVehicles: 4,
      agingCount: 3,
      agingPercent: 75,
      averageDaysInStock: 110, // 441 / 4 = 110.25
      needsAttentionCount: 1,
    },
  },
  {
    name: '2 of 3 aging rounds to 66.7%',
    vehicles: ofAges([91, 100, 10]),
    expected: {
      totalVehicles: 3,
      agingCount: 2,
      agingPercent: 66.7,
      averageDaysInStock: 67, // 201 / 3
      needsAttentionCount: 2,
    },
  },
  {
    name: '1 of 3 aging rounds to 33.3%',
    vehicles: ofAges([91, 0, 0]),
    expected: {
      totalVehicles: 3,
      agingCount: 1,
      agingPercent: 33.3,
      averageDaysInStock: 30, // 91 / 3 = 30.33
      needsAttentionCount: 1,
    },
  },
  {
    name: '1 of 8 aging is 12.5%',
    vehicles: ofAges([91, 0, 0, 0, 0, 0, 0, 0]),
    expected: {
      totalVehicles: 8,
      agingCount: 1,
      agingPercent: 12.5,
      averageDaysInStock: 11, // 91 / 8 = 11.375
      needsAttentionCount: 1,
    },
  },
  {
    name: 'the 90/91 boundary: 90 is not aging, 91 is (BR-02)',
    vehicles: ofAges([90, 91]),
    expected: {
      totalVehicles: 2,
      agingCount: 1,
      agingPercent: 50,
      averageDaysInStock: 91, // 181 / 2 = 90.5, half up
      needsAttentionCount: 1,
    },
  },
  {
    name: 'an average of exactly .5 rounds up (0 and 1 give 1)',
    vehicles: ofAges([0, 1]),
    expected: {
      totalVehicles: 2,
      agingCount: 0,
      agingPercent: 0,
      averageDaysInStock: 1,
      needsAttentionCount: 0,
    },
  },
  {
    name: 'a future-dated vehicle counts as age 0 in the average (BR-01, TA-22)',
    serverOnly: true, // the mock gets daysInStock pre-clamped; only the API derives it from a date
    vehicles: ofAges([-30, 10]),
    expected: {
      totalVehicles: 2,
      agingCount: 0,
      agingPercent: 0,
      averageDaysInStock: 5, // (0 + 10) / 2, not (-30 + 10) / 2
      needsAttentionCount: 0,
    },
  },
  {
    name: 'all aging, all actioned: 100% and nothing needs attention',
    vehicles: [acted(0, 91), acted(1, 365)],
    expected: {
      totalVehicles: 2,
      agingCount: 2,
      agingPercent: 100,
      averageDaysInStock: 228,
      needsAttentionCount: 0,
    },
  },
  {
    name: 'an action on a non-aging vehicle does not affect needs attention',
    vehicles: [acted(0, 90), vehicle(1, 91)],
    expected: {
      totalVehicles: 2,
      agingCount: 1,
      agingPercent: 50,
      averageDaysInStock: 91,
      needsAttentionCount: 1,
    },
  },
  {
    // Divide-first (count / total * 1000) gives 502.49999... and rounds down to 50.2.
    name: '201 of 400 aging is 50.25%, rounded half up to 50.3 (TA-21, float-safe)',
    vehicles: agingOf(201, 400),
    expected: {
      totalVehicles: 400,
      agingCount: 201,
      agingPercent: 50.3,
      averageDaysInStock: 46, // 18291 / 400 = 45.7275
      needsAttentionCount: 201,
    },
  },
  {
    name: '1 of 16 aging is exactly 6.25%, rounded half up to 6.3 (TA-21)',
    vehicles: agingOf(1, 16),
    expected: {
      totalVehicles: 16,
      agingCount: 1,
      agingPercent: 6.3,
      averageDaysInStock: 6, // 91 / 16 = 5.6875
      needsAttentionCount: 1,
    },
  },
  {
    // Documented behaviour: a non-zero count can show 0.0 % (0.04998 % rounds down).
    name: '1 of 2001 aging rounds to 0% although agingCount is 1 (TA-21)',
    vehicles: agingOf(1, 2001),
    expected: {
      totalVehicles: 2001,
      agingCount: 1,
      agingPercent: 0,
      averageDaysInStock: 0, // 91 / 2001 = 0.045
      needsAttentionCount: 1,
    },
  },
  {
    // Documented behaviour: 99.95002 % rounds up to 100 % although one vehicle is not aging.
    name: '2000 of 2001 aging rounds to 100% although one vehicle is not aging (TA-21)',
    vehicles: agingOf(2000, 2001),
    expected: {
      totalVehicles: 2001,
      agingCount: 2000,
      agingPercent: 100,
      averageDaysInStock: 91, // 182000 / 2001 = 90.95
      needsAttentionCount: 2000,
    },
  },
  {
    name: 'a single aging vehicle without an action',
    vehicles: ofAges([91]),
    expected: {
      totalVehicles: 1,
      agingCount: 1,
      agingPercent: 100,
      averageDaysInStock: 91,
      needsAttentionCount: 1,
    },
  },
  {
    // Server: action history must not multiply rows (a JOIN would count this vehicle 3 times).
    // Mock: only the current action exists, so this reduces to "has an action".
    name: 'a vehicle with several actions counts once and as actioned (BR-16)',
    vehicles: [vehicle(0, 120, 3), vehicle(1, 91)],
    expected: {
      totalVehicles: 2,
      agingCount: 2,
      agingPercent: 100,
      averageDaysInStock: 106, // 211 / 2 = 105.5, half up
      needsAttentionCount: 1,
    },
  },
  {
    name: 'a future-dated vehicle with an action is age 0, not aging, not needing attention',
    serverOnly: true, // the mock has no stock-in date logic
    vehicles: [acted(0, -10), vehicle(1, 91)],
    expected: {
      totalVehicles: 2,
      agingCount: 1,
      agingPercent: 50,
      averageDaysInStock: 46, // (0 + 91) / 2 = 45.5, half up
      needsAttentionCount: 1,
    },
  },
];
