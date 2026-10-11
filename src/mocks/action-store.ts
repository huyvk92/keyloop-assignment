import {
  CreateActionBodySchema,
  type ActionEntry,
  type CreateActionBodyInput,
} from '@shared/api/actions';
import type { ApiError } from '@shared/api/common';
import type { Dealership } from '@shared/api/dealerships';
import {
  AGING_THRESHOLD_DAYS,
  VehicleParamsSchema,
  type VehicleDetail,
  type VehicleListItem,
} from '@shared/api/vehicles';
import {
  FIXTURE_TODAY,
  fixtureActions,
  fixtureDealerships,
  fixtureVehicles,
  newestFirst,
  withHistory,
} from '@/mocks/fixtures';

/**
 * In-memory equivalent of POST /api/vehicles/:vehicleId/actions and the history reads (the
 * server's `actions.service.ts` + `inventory.service.ts`), kept honest by the shared
 * CREATE_ACTION_CASES table (src/mocks/action-store.test.ts). Appended entries change the list's
 * current action, the needs-attention flag and the KPI count, as on the API (BR-14, BR-16).
 */

/** The mock's clock: noon UTC on FIXTURE_TODAY, like the API's `fixedClock` under APP_TODAY. */
export const MOCK_NOW = `${FIXTURE_TODAY}T12:00:00.000Z`;

export type MockActionOutcome =
  { status: 201; body: ActionEntry } | { status: 400 | 404 | 422; body: ApiError };

type StoreOptions = {
  vehicles: readonly VehicleListItem[];
  dealerships: readonly Dealership[];
  /** History that exists before any POST (never changed: append-only, BR-13). */
  baseActions?: readonly ActionEntry[];
  /** ISO-8601 UTC timestamp for new entries (TA-12, TA-13). */
  now?: () => string;
};

const error = (status: 400 | 404 | 422, code: string, message: string, details?: unknown) =>
  ({
    status,
    body: { error: { code, message, ...(details === undefined ? {} : { details }) } },
  }) as const;

export function createActionStore({
  vehicles,
  dealerships,
  baseActions = [],
  now = () => MOCK_NOW,
}: StoreOptions) {
  let appended: ActionEntry[] = [];
  const all = () => [...baseActions, ...appended];
  const historyOf = (vehicleId: number) =>
    newestFirst(all().filter((entry) => entry.vehicleId === vehicleId));
  const touched = () => new Set(appended.map((entry) => entry.vehicleId));

  return {
    /** Forget every appended entry (the base history stays). */
    reset(): void {
      appended = [];
    },

    /** Entries appended since the last reset, oldest first. */
    appended(): readonly ActionEntry[] {
      return appended;
    },

    /** A vehicle's history, newest first (BR-13). */
    history: historyOf,

    /** All vehicles, with the current action of those that got a new entry re-derived. */
    vehicles(): VehicleListItem[] {
      const changed = touched();
      if (changed.size === 0) return [...vehicles];
      return vehicles.map((v) => (changed.has(v.id) ? withHistory(v, historyOf(v.id)) : v));
    },

    /** GET /api/vehicles/:vehicleId body, or undefined for an unknown vehicle. */
    detail(vehicleId: number): VehicleDetail | undefined {
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      const dealership = dealerships.find((d) => d.id === vehicle?.dealershipId);
      if (!vehicle || !dealership) return undefined;
      const actions = historyOf(vehicleId);
      return {
        ...withHistory(vehicle, actions),
        currency: dealership.currency,
        timeZone: dealership.timeZone,
        actions,
      };
    },

    /**
     * POST with the API's precedence: 400 (params, then body) before 404 before 422. Every
     * rejection stores nothing (BR-18). `rawBody` is the already-parsed JSON (see the handler).
     * Like the API, a 400 carries the failing part's issues as `details`.
     */
    log(rawVehicleId: unknown, rawBody: unknown): MockActionOutcome {
      const params = VehicleParamsSchema.safeParse({ vehicleId: rawVehicleId });
      if (!params.success) {
        return error(400, 'VALIDATION_ERROR', 'Request validation failed', params.error.issues);
      }
      const body = CreateActionBodySchema.safeParse(rawBody);
      if (!body.success) {
        return error(400, 'VALIDATION_ERROR', 'Request validation failed', body.error.issues);
      }
      const { vehicleId } = params.data;
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      if (!vehicle) return error(404, 'NOT_FOUND', `Vehicle ${vehicleId} not found`);
      if (!vehicle.isAging) {
        return error(
          422,
          'VEHICLE_NOT_AGING',
          `Actions can only be logged for vehicles in stock for more than ${AGING_THRESHOLD_DAYS} days`,
          { daysInStock: vehicle.daysInStock },
        );
      }

      const entry: ActionEntry = {
        id: Math.max(0, ...all().map((e) => e.id)) + 1,
        vehicleId,
        status: body.data.status,
        note: body.data.note || null, // the schema turns a blank note into '' (TA-17)
        loggedBy: body.data.loggedBy,
        loggedAt: now(),
      };
      appended = [...appended, entry];
      return { status: 201, body: entry };
    },
  };
}

/** The store behind the default MSW handlers (fixture vehicles and their history). */
export const mockActionStore = createActionStore({
  vehicles: fixtureVehicles,
  dealerships: fixtureDealerships,
  baseActions: fixtureActions,
});

/**
 * Drops actions logged through the default handlers. Must run after every test (in
 * src/test/setup.ts, next to `server.resetHandlers()`), or a POST in one test leaks into the next.
 */
export function resetMockActionStore(): void {
  mockActionStore.reset();
}

/** Convenience for tests: a valid body for the AC-006.3 example. */
export const EXAMPLE_ACTION_BODY = {
  status: 'Price Reduction Planned',
  note: 'Reduce by 5%',
  loggedBy: 'Jane Smith',
} as const satisfies CreateActionBodyInput;
