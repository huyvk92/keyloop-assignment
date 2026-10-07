import { CurrentActionSchema, type CurrentAction } from '@shared/api/actions';
import { DealershipSchema, type Dealership } from '@shared/api/dealerships';
import {
  AGING_THRESHOLD_DAYS,
  PAGE_SIZE_DEFAULT,
  VehicleListItemSchema,
  VehicleListResponseSchema,
  type VehicleListItem,
  type VehicleListResponse,
} from '@shared/api/vehicles';

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

const MODELS = [
  { make: 'Ford', model: 'Focus', trim: 'Titanium' },
  { make: 'Toyota', model: 'Corolla', trim: 'Design' },
  { make: 'BMW', model: '3 Series', trim: 'M Sport' },
  { make: 'Audi', model: 'A3', trim: 'Sport' },
  { make: 'Volkswagen', model: 'Golf', trim: 'Life' },
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

/** Default data set, shaped like the seed: 4 dealerships A-Z, York without stock (TA-15). */
export const fixtureDealerships: Dealership[] = [
  buildDealership({ id: 1, name: 'Birmingham' }),
  buildDealership({ id: 2, name: 'Leeds' }),
  buildDealership({ id: 3, name: 'Manchester' }),
  buildDealership({ id: 4, name: 'York' }),
];

export const fixtureVehicles: VehicleListItem[] = [
  ...buildVehicles(30, { dealershipId: 1, startId: 1 }),
  ...buildVehicles(4, { dealershipId: 2, startId: 101, oldestAge: 120 }),
  ...buildVehicles(2, { dealershipId: 3, startId: 201, oldestAge: 40 }),
];
