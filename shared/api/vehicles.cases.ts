/**
 * Shared list-query scenarios (filter + search + sort) run against BOTH the real API
 * (server/src/modules/inventory/inventory.parity.test.ts, SQLite) and the MSW mock
 * (src/mocks/vehicle-query.test.ts, in-memory), so the two cannot drift apart. The server is the
 * source of truth: when a row fails only on the web side, fix the mock.
 *
 * Pure data: no imports. `query` is a raw, URL-encoded query string; `expected` lists the stock
 * numbers of the first page (default pageSize 25) in order. "Today" is 2026-10-07 on both sides.
 */

export type ScenarioVehicle = {
  ageDays: number;
  make: string;
  model: string;
  stockNumber: string;
  /** 17 characters; defaults to `scenarioVin(index)`. */
  vin?: string;
  priceMinor: number;
  /** Has one logged action (so it is never "needs attention", BR-16). */
  hasAction: boolean;
};

export type VehicleQueryScenario = {
  name: string;
  vehicles: ScenarioVehicle[];
  query: string;
  expected: string[];
};

export const SCENARIO_TODAY = '2026-10-07';

/** Default VIN for the vehicle at `index`; 'Z' and digits only, so no search needle hits it. */
export const scenarioVin = (index: number) => `ZZZZZZZ${String(index).padStart(10, '0')}`;

type VehicleOverrides = Partial<Omit<ScenarioVehicle, 'stockNumber'>>;
const vehicle = (stockNumber: string, overrides: VehicleOverrides = {}): ScenarioVehicle => ({
  ageDays: 10,
  make: 'Ford',
  model: 'Focus',
  priceMinor: 1_000_000,
  hasAction: false,
  stockNumber,
  ...overrides,
});
const aged = (stockNumber: string, ageDays: number, overrides: VehicleOverrides = {}) =>
  vehicle(stockNumber, { ...overrides, ageDays });
const q = (text: string) => `q=${encodeURIComponent(text)}`;

/** Every bucket boundary (BR-07, TA-07). Listed newest first so the age sort does real work. */
const BOUNDARY_STOCK = [0, 30, 31, 60, 61, 90, 91, 400].map((age) =>
  aged(`B-${String(age).padStart(3, '0')}`, age),
);
/** Around a custom 45-90 range. */
const RANGE_STOCK = [44, 45, 90, 91].map((age) => aged(`R-${String(age).padStart(3, '0')}`, age));
/** Aging boundary with and without an action (BR-02, BR-16). */
const ATTENTION_STOCK = [
  aged('N-090-none', 90),
  aged('N-090-acted', 90, { hasAction: true }),
  aged('N-091-none', 91),
  aged('N-091-acted', 91, { hasAction: true }),
  aged('N-200-none', 200),
];
/**
 * Ties on every key: S-3/S-4 share age and price, S-2/S-5 share age and price, S-1/S-2 share
 * make/model, S-4/S-5 share make/model ignoring case. Inserted out of stock-number order.
 */
const SORT_STOCK = [
  vehicle('S-4', { ageDays: 100, make: 'Ford', model: 'Focus', priceMinor: 1_000_000 }),
  vehicle('S-2', { ageDays: 50, make: 'Audi', model: 'A3', priceMinor: 2_000_000 }),
  vehicle('S-3', { ageDays: 100, make: 'BMW', model: 'X1', priceMinor: 1_000_000 }),
  vehicle('S-1', { ageDays: 10, make: 'Audi', model: 'A3', priceMinor: 500_000 }),
  vehicle('S-5', { ageDays: 50, make: 'ford', model: 'focus', priceMinor: 2_000_000 }),
];

export const VEHICLE_QUERY_SCENARIOS: VehicleQueryScenario[] = [
  // Buckets, each alone (inclusive bounds)
  {
    name: 'bucket 0-30 includes 0 and 30',
    vehicles: BOUNDARY_STOCK,
    query: 'ageBucket=0-30',
    expected: ['B-030', 'B-000'],
  },
  {
    name: 'bucket 31-60 includes 31 and 60',
    vehicles: BOUNDARY_STOCK,
    query: 'ageBucket=31-60',
    expected: ['B-060', 'B-031'],
  },
  {
    name: 'bucket 61-90 includes 61 and 90',
    vehicles: BOUNDARY_STOCK,
    query: 'ageBucket=61-90',
    expected: ['B-090', 'B-061'],
  },
  {
    name: 'bucket over-90 starts at 91',
    vehicles: BOUNDARY_STOCK,
    query: 'ageBucket=over-90',
    expected: ['B-400', 'B-091'],
  },
  {
    name: 'no filter returns everything, oldest first',
    vehicles: BOUNDARY_STOCK,
    query: '',
    expected: ['B-400', 'B-091', 'B-090', 'B-061', 'B-060', 'B-031', 'B-030', 'B-000'],
  },
  // Custom range
  {
    name: 'custom range 45-90 is inclusive (44 and 91 excluded)',
    vehicles: RANGE_STOCK,
    query: 'minAge=45&maxAge=90',
    expected: ['R-090', 'R-045'],
  },
  {
    name: 'custom range with min = max',
    vehicles: RANGE_STOCK,
    query: 'minAge=45&maxAge=45',
    expected: ['R-045'],
  },
  {
    name: 'only a minimum age',
    vehicles: RANGE_STOCK,
    query: 'minAge=90',
    expected: ['R-091', 'R-090'],
  },
  {
    name: 'only a maximum age',
    vehicles: RANGE_STOCK,
    query: 'maxAge=44',
    expected: ['R-044'],
  },
  {
    name: 'bucket and range intersect',
    vehicles: [...BOUNDARY_STOCK, aged('B-045', 45)],
    query: 'ageBucket=31-60&minAge=45',
    expected: ['B-060', 'B-045'],
  },
  {
    name: 'empty bucket/range intersection gives no rows',
    vehicles: BOUNDARY_STOCK,
    query: 'ageBucket=0-30&minAge=45&maxAge=90',
    expected: [],
  },
  {
    name: 'over-90 bucket with maxAge 90 gives no rows',
    vehicles: BOUNDARY_STOCK,
    query: 'ageBucket=over-90&maxAge=90',
    expected: [],
  },
  // Aging flags
  {
    name: 'agingOnly keeps 91 and drops 90',
    vehicles: ATTENTION_STOCK,
    query: 'agingOnly=true',
    expected: ['N-200-none', 'N-091-acted', 'N-091-none'],
  },
  {
    name: 'agingOnly=false applies no restriction',
    vehicles: RANGE_STOCK,
    query: 'agingOnly=false',
    expected: ['R-091', 'R-090', 'R-045', 'R-044'],
  },
  {
    name: 'agingOnly with a 61-90 bucket gives no rows',
    vehicles: BOUNDARY_STOCK,
    query: 'agingOnly=true&ageBucket=61-90',
    expected: [],
  },
  {
    name: 'needsAttention = aging and no action (90/91 with and without action)',
    vehicles: ATTENTION_STOCK,
    query: 'needsAttention=true',
    expected: ['N-200-none', 'N-091-none'],
  },
  {
    name: 'needsAttention=false applies no restriction',
    vehicles: ATTENTION_STOCK,
    query: 'needsAttention=false',
    expected: ['N-200-none', 'N-091-acted', 'N-091-none', 'N-090-acted', 'N-090-none'],
  },
  // Make / model
  {
    name: 'make AND over-90',
    vehicles: [
      aged('M-1', 91, { make: 'Ford' }),
      aged('M-2', 90, { make: 'Ford' }),
      aged('M-3', 91, { make: 'Toyota', model: 'Yaris' }),
      aged('M-4', 120, { make: 'Ford' }),
    ],
    query: 'make=Ford&ageBucket=over-90',
    expected: ['M-4', 'M-1'],
  },
  {
    name: 'make and model match exactly (case-sensitive facet values)',
    vehicles: [
      vehicle('M-1', { make: 'Ford', model: 'Focus' }),
      vehicle('M-2', { make: 'Ford', model: 'Fiesta' }),
      vehicle('M-3', { make: 'ford', model: 'Focus' }),
    ],
    query: 'make=Ford&model=Focus',
    expected: ['M-1'],
  },
  // Search (BR-08): literal, ASCII case-insensitive, on VIN, stock number and model
  {
    name: 'q "%" is literal',
    vehicles: [vehicle('Q-1', { model: 'Promo 100%' }), vehicle('Q-2', { model: 'Promo 1000' })],
    query: q('0%'),
    expected: ['Q-1'],
  },
  {
    name: 'q "_" is literal and case-insensitive',
    vehicles: [vehicle('Q-1', { model: 'A_B' }), vehicle('Q-2', { model: 'AxB' })],
    query: q('a_b'),
    expected: ['Q-1'],
  },
  {
    name: 'q "\\" is literal',
    vehicles: [vehicle('Q-1', { model: 'Back\\Slash' }), vehicle('Q-2', { model: 'BackSlash' })],
    query: q('k\\s'),
    expected: ['Q-1'],
  },
  {
    name: 'q matches VIN, stock number and model ignoring ASCII case, not make',
    vehicles: [
      vehicle('Q-1', { vin: 'WF0ABCDEFGH123456', model: 'Puma' }),
      vehicle('Q-2', { model: 'Kuga' }),
      vehicle('ABC-9', { model: 'Puma' }),
      vehicle('Q-3', { make: 'Abc Motors', model: 'Puma' }),
    ],
    query: q('  aBc '),
    expected: ['ABC-9', 'Q-1'],
  },
  {
    name: 'q on model, upper-case needle',
    vehicles: [vehicle('Q-1', { model: 'Focus' }), vehicle('Q-2', { model: 'Fiesta' })],
    query: q('FOCUS'),
    expected: ['Q-1'],
  },
  {
    name: 'q does not fold non-ASCII case ("ë" vs "Ëlan")',
    vehicles: [vehicle('Q-1', { make: 'Lotus', model: 'Ëlan' })],
    query: q('ë'),
    expected: [],
  },
  {
    name: 'q matches non-ASCII with the exact case',
    vehicles: [
      vehicle('Q-1', { make: 'Lotus', model: 'Ëlan' }),
      vehicle('Q-2', { make: 'Lotus', model: 'ëlan' }),
    ],
    query: q('Ël'),
    expected: ['Q-1'],
  },
  // Sorting: every key x order, ties broken by stock number ascending (BR-17, TA-06)
  {
    name: 'default sort is age desc (oldest first)',
    vehicles: SORT_STOCK,
    query: '',
    expected: ['S-3', 'S-4', 'S-2', 'S-5', 'S-1'],
  },
  {
    name: 'sort age desc',
    vehicles: SORT_STOCK,
    query: 'sort=age&order=desc',
    expected: ['S-3', 'S-4', 'S-2', 'S-5', 'S-1'],
  },
  {
    name: 'sort age asc',
    vehicles: SORT_STOCK,
    query: 'sort=age&order=asc',
    expected: ['S-1', 'S-2', 'S-5', 'S-3', 'S-4'],
  },
  {
    name: 'sort price defaults to asc',
    vehicles: SORT_STOCK,
    query: 'sort=price',
    expected: ['S-1', 'S-3', 'S-4', 'S-2', 'S-5'],
  },
  {
    name: 'sort price asc',
    vehicles: SORT_STOCK,
    query: 'sort=price&order=asc',
    expected: ['S-1', 'S-3', 'S-4', 'S-2', 'S-5'],
  },
  {
    name: 'sort price desc',
    vehicles: SORT_STOCK,
    query: 'sort=price&order=desc',
    expected: ['S-2', 'S-5', 'S-3', 'S-4', 'S-1'],
  },
  {
    name: 'sort makeModel defaults to asc',
    vehicles: SORT_STOCK,
    query: 'sort=makeModel',
    expected: ['S-1', 'S-2', 'S-3', 'S-4', 'S-5'],
  },
  {
    name: 'sort makeModel asc (Ford = ford)',
    vehicles: SORT_STOCK,
    query: 'sort=makeModel&order=asc',
    expected: ['S-1', 'S-2', 'S-3', 'S-4', 'S-5'],
  },
  {
    name: 'sort makeModel desc keeps the tie-break ascending',
    vehicles: SORT_STOCK,
    query: 'sort=makeModel&order=desc',
    expected: ['S-4', 'S-5', 'S-3', 'S-1', 'S-2'],
  },
  {
    name: 'tie-break by stock number under an active filter',
    vehicles: [
      vehicle('T-3', { make: 'Audi', model: 'A3', priceMinor: 1_500_000 }),
      vehicle('T-1', { make: 'Audi', model: 'A3', priceMinor: 1_500_000 }),
      vehicle('T-0', { make: 'BMW', model: 'X1', priceMinor: 1_500_000 }),
      vehicle('T-2', { make: 'Audi', model: 'A3', priceMinor: 1_500_000 }),
    ],
    query: 'make=Audi&sort=price&order=desc',
    expected: ['T-1', 'T-2', 'T-3'],
  },
  {
    name: 'tie-break is binary on stock number (upper case before lower case)',
    vehicles: [vehicle('b-1'), vehicle('B-2'), vehicle('a-3')],
    query: 'sort=age',
    expected: ['B-2', 'a-3', 'b-1'],
  },
  {
    name: 'makeModel ignores ASCII case (Hyundai i10 before IONIQ 5 before Tucson)',
    vehicles: [
      vehicle('H-1', { make: 'Hyundai', model: 'Tucson' }),
      vehicle('H-2', { make: 'Hyundai', model: 'IONIQ 5' }),
      vehicle('H-3', { make: 'Hyundai', model: 'i10' }),
    ],
    query: 'sort=makeModel',
    expected: ['H-3', 'H-2', 'H-1'],
  },
  {
    name: 'makeModel desc (Tucson, IONIQ 5, i10)',
    vehicles: [
      vehicle('H-1', { make: 'Hyundai', model: 'Tucson' }),
      vehicle('H-2', { make: 'Hyundai', model: 'IONIQ 5' }),
      vehicle('H-3', { make: 'Hyundai', model: 'i10' }),
    ],
    query: 'sort=makeModel&order=desc',
    expected: ['H-1', 'H-2', 'H-3'],
  },
  {
    name: 'makeModel folds to lower case ("_" sorts before letters)',
    vehicles: [
      vehicle('F-1', { make: 'Kia', model: 'AB' }),
      vehicle('F-2', { make: 'Kia', model: 'A_1' }),
    ],
    query: 'sort=makeModel',
    expected: ['F-2', 'F-1'],
  },
  {
    name: 'makeModel does not fold non-ASCII case (Ëlan before ëlan)',
    vehicles: [
      vehicle('E-1', { make: 'Lotus', model: 'ëlan' }),
      vehicle('E-2', { make: 'Lotus', model: 'Ëlan' }),
      vehicle('E-3', { make: 'Lotus', model: 'Elise' }),
    ],
    query: 'sort=makeModel',
    expected: ['E-3', 'E-2', 'E-1'],
  },
];
