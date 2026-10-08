import {
  ActionEntrySchema,
  CurrentActionSchema,
  type ActionEntry,
  type CurrentAction,
} from '@shared/api/actions';
import { DealershipSchema, type Dealership } from '@shared/api/dealerships';
import {
  AGING_THRESHOLD_DAYS,
  FacetsResponseSchema,
  InventorySummarySchema,
  PAGE_SIZE_DEFAULT,
  VehicleListItemSchema,
  VehicleListResponseSchema,
  type FacetsResponse,
  type InventorySummary,
  type VehicleListItem,
  type VehicleListResponse,
} from '@shared/api/vehicles';
import { foldAsciiCase } from '@/mocks/vehicle-query';

/**
 * Deterministic API fixtures for MSW (tests, Storybook, VITE_USE_MOCKS). Every builder parses its
 * output with the shared contract, so a fixture can never drift from what the API returns.
 */

/** "Today" the fixtures are relative to; matches the demo's APP_TODAY. */
export const FIXTURE_TODAY = '2026-10-07';

function daysBefore(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

export function buildDealership(overrides: Partial<Dealership> = {}): Dealership {
  return DealershipSchema.parse({
    id: 1,
    name: 'Birmingham',
    currency: 'GBP',
    timeZone: 'Europe/London',
    ...overrides,
  });
}

export function buildCurrentAction(overrides: Partial<CurrentAction> = {}): CurrentAction {
  return CurrentActionSchema.parse({
    status: 'Under Review',
    loggedBy: 'Jane Smith',
    loggedAt: '2026-10-07T09:00:00.000Z',
    ...overrides,
  });
}

/** One history entry (BR-13); defaults to an "Under Review" by Jane Smith at 09:00 UTC. */
export function buildActionEntry(overrides: Partial<ActionEntry> = {}): ActionEntry {
  return ActionEntrySchema.parse({
    id: 1,
    vehicleId: 1,
    status: 'Under Review',
    note: null,
    loggedBy: 'Jane Smith',
    loggedAt: '2026-10-07T09:00:00.000Z',
    ...overrides,
  });
}

/** The API's history order: `loggedAt` desc, then id desc for equal timestamps (BR-13, TA-13). */
export function newestFirst(entries: readonly ActionEntry[]): ActionEntry[] {
  return [...entries].sort((a, b) =>
    a.loggedAt === b.loggedAt ? b.id - a.id : a.loggedAt < b.loggedAt ? 1 : -1,
  );
}

/**
 * `vehicle` with its current action and needs-attention flag re-derived from `history` (BR-14,
 * BR-16), as the API derives them from the latest row. An empty history means "No action".
 */
export function withHistory(
  vehicle: VehicleListItem,
  history: readonly ActionEntry[],
): VehicleListItem {
  const latest = newestFirst(history)[0];
  const currentAction = latest
    ? { status: latest.status, loggedBy: latest.loggedBy, loggedAt: latest.loggedAt }
    : null;
  return { ...vehicle, currentAction, needsAttention: vehicle.isAging && currentAction === null };
}

/** Two models per make, so model options visibly depend on the make (BR-06). */
const MODELS = [
  { make: 'Ford', model: 'Focus', trim: 'Titanium' },
  { make: 'Toyota', model: 'Corolla', trim: 'Design' },
  { make: 'BMW', model: '3 Series', trim: 'M Sport' },
  { make: 'Audi', model: 'A3', trim: 'Sport' },
  { make: 'Volkswagen', model: 'Golf', trim: 'Life' },
  { make: 'Ford', model: 'Fiesta', trim: 'ST-Line' },
  { make: 'Toyota', model: 'Yaris', trim: 'Icon' },
  { make: 'BMW', model: 'X1', trim: 'Sport' },
  { make: 'Audi', model: 'Q3', trim: 'S line' },
  { make: 'Volkswagen', model: 'Polo', trim: 'Match' },
] as const;
const COLOURS = ['Black', 'White', 'Silver', 'Blue', 'Red'] as const;

/**
 * One list item. `stockInDate`, `isAging` and `needsAttention` are derived from `daysInStock` and
 * `currentAction` (BR-02, BR-16) unless overridden.
 */
export function buildVehicle(overrides: Partial<VehicleListItem> = {}): VehicleListItem {
  const id = overrides.id ?? 1;
  const daysInStock = overrides.daysInStock ?? 30;
  const currentAction = overrides.currentAction ?? null;
  const isAging = daysInStock > AGING_THRESHOLD_DAYS;
  // Modulo on a non-empty constant tuple always yields an element.
  const spec = MODELS[id % MODELS.length] as (typeof MODELS)[number];
  return VehicleListItemSchema.parse({
    id,
    dealershipId: 1,
    vin: `WMOCK${String(id).padStart(12, '0')}`,
    stockNumber: `STK-${String(1000 + id)}`,
    make: spec.make,
    model: spec.model,
    trim: spec.trim,
    modelYear: 2018 + (id % 7),
    colour: COLOURS[id % COLOURS.length],
    mileage: 5000 + id * 1234,
    listPriceMinor: 1_500_000 + id * 25_000,
    stockInDate: daysBefore(FIXTURE_TODAY, daysInStock),
    daysInStock,
    isAging,
    needsAttention: isAging && currentAction === null,
    currentAction,
    ...overrides,
  });
}

type BuildVehiclesOptions = { dealershipId?: number; startId?: number; oldestAge?: number };

/** `count` vehicles in the API's default order (oldest first), ages decreasing by 6 days. */
export function buildVehicles(
  count: number,
  { dealershipId = 1, startId = 1, oldestAge = 200 }: BuildVehiclesOptions = {},
): VehicleListItem[] {
  return Array.from({ length: count }, (_, index) =>
    buildVehicle({
      id: startId + index,
      dealershipId,
      daysInStock: Math.max(0, oldestAge - index * 6),
      currentAction: index % 3 === 0 ? buildCurrentAction() : null,
    }),
  );
}

type PageOptions = { page?: number; pageSize?: number };

/** One page of `all`, with the real total (a page past the end has `items: []`, TA-05). */
export function buildVehiclePage(
  all: VehicleListItem[],
  { page = 1, pageSize = PAGE_SIZE_DEFAULT }: PageOptions = {},
): VehicleListResponse {
  const start = (page - 1) * pageSize;
  return VehicleListResponseSchema.parse({
    items: all.slice(start, start + pageSize),
    total: all.length,
    page,
    pageSize,
  });
}

const byText = (a: string, b: string) => {
  // ASCII case-insensitive, like the API's COLLATE NOCASE (TA-27); exact text breaks ties.
  const [x, y] = [foldAsciiCase(a), foldAsciiCase(b)];
  if (x !== y) return x < y ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
};

/** Distinct makes A-Z, each with its distinct models A-Z, as GET .../facets returns (BR-06). */
export function buildFacets(vehicles: VehicleListItem[]): FacetsResponse {
  const models = new Map<string, Set<string>>();
  for (const v of vehicles) {
    const set = models.get(v.make) ?? new Set<string>();
    set.add(v.model);
    models.set(v.make, set);
  }
  return FacetsResponseSchema.parse({
    makes: [...models.keys()].sort(byText).map((make) => ({
      make,
      models: [...(models.get(make) ?? [])].sort(byText),
    })),
  });
}

/**
 * A KPI summary, by default the AC-005.1 example (8 / 3 / 37.5 % / 75 days). Handlers compute
 * the real values from the fixtures with `summarizeVehicles` (src/mocks/summary-query.ts).
 */
export function buildSummary(overrides: Partial<InventorySummary> = {}): InventorySummary {
  return InventorySummarySchema.parse({
    asOfDate: FIXTURE_TODAY,
    totalVehicles: 8,
    agingCount: 3,
    agingPercent: 37.5,
    averageDaysInStock: 75,
    needsAttentionCount: 2,
    ...overrides,
  });
}

/** Default data set, shaped like the seed: 4 dealerships A-Z, York without stock (TA-15). */
export const fixtureDealerships: Dealership[] = [
  buildDealership({ id: 1, name: 'Birmingham' }),
  buildDealership({ id: 2, name: 'Leeds' }),
  buildDealership({ id: 3, name: 'Manchester' }),
  buildDealership({ id: 4, name: 'York' }),
];

const stock: VehicleListItem[] = [
  ...buildVehicles(30, { dealershipId: 1, startId: 1 }),
  ...buildVehicles(4, { dealershipId: 2, startId: 101, oldestAge: 120 }),
  // Vehicle 201 is 45 days old: non-aging, yet it has a history (AC-006.2, A-15).
  ...buildVehicles(2, { dealershipId: 3, startId: 201, oldestAge: 45 }),
];

/** Fixture vehicles with a hand-written history (TRD §4.5 seed highlights). */
export const FIXTURE_HISTORY_VEHICLES = {
  /** 09:00 "Under Review" then 11:00 "Marketing Promotion" (AC-007.4). */
  twoEntries: 1,
  /** A note with markup that must render as text (AC-006.8). */
  markupNote: 4,
  /** 45 days, not aging, one entry: history visible, no form (AC-006.2). */
  nonAging: 201,
} as const;

const SPECIAL_HISTORY: Partial<Record<number, Omit<Partial<ActionEntry>, 'id' | 'vehicleId'>[]>> = {
  [FIXTURE_HISTORY_VEHICLES.twoEntries]: [
    { status: 'Under Review', loggedAt: '2026-10-07T09:00:00.000Z' },
    {
      status: 'Marketing Promotion',
      note: 'Feature in the weekend email campaign',
      loggedBy: 'Sam Patel',
      loggedAt: '2026-10-07T11:00:00.000Z',
    },
  ],
  [FIXTURE_HISTORY_VEHICLES.markupNote]: [{ status: 'Under Review', note: '<b>cut</b>' }],
  [FIXTURE_HISTORY_VEHICLES.nonAging]: [
    { status: 'Under Review', note: 'Checked on arrival', loggedAt: '2026-09-01T10:15:00.000Z' },
  ],
};

/**
 * The fixed history behind the fixtures: the hand-written entries above, plus one default entry
 * (09:00 "Under Review") for every other vehicle `buildVehicles` gave a current action. Ids are
 * sequential in stock order. Actions logged at runtime live in `src/mocks/action-store.ts`.
 */
export const fixtureActions: ActionEntry[] = stock
  .flatMap((vehicle) =>
    (SPECIAL_HISTORY[vehicle.id] ?? (vehicle.currentAction ? [{}] : [])).map((entry) => ({
      vehicleId: vehicle.id,
      ...entry,
    })),
  )
  .map((entry, index) => buildActionEntry({ ...entry, id: index + 1 }));

/** Every fixture vehicle, its current action derived from `fixtureActions` (BR-14). */
export const fixtureVehicles: VehicleListItem[] = stock.map((vehicle) =>
  withHistory(
    vehicle,
    fixtureActions.filter((entry) => entry.vehicleId === vehicle.id),
  ),
);
