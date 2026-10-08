import { caseRequest, CREATE_ACTION_CASES, type CreateActionCase } from '@shared/api/actions.cases';
import { ActionEntrySchema } from '@shared/api/actions';
import { ApiErrorSchema } from '@shared/api/common';
import {
  InventorySummarySchema,
  VehicleDetailSchema,
  VehicleListResponseSchema,
} from '@shared/api/vehicles';
import { apiUrl, fetchJson, type HttpError } from '@/lib/http';
import {
  createActionStore,
  EXAMPLE_ACTION_BODY,
  MOCK_NOW,
  mockActionStore,
} from '@/mocks/action-store';
import {
  buildActionEntry,
  buildDealership,
  FIXTURE_HISTORY_VEHICLES,
  fixtureActions,
  fixtureVehicles,
  buildVehicle,
} from '@/mocks/fixtures';
import { logActionHandler } from '@/mocks/handlers';
import { server } from '@/mocks/server';

/**
 * Mock side of the create-action parity guard: the same table runs against the real API in
 * server/src/modules/actions/actions.parity.test.ts. Each row goes through the real MSW POST
 * handler (body parsing, params, store), backed by a store holding only the scenario's vehicle.
 * When a row fails only here, the mock is wrong (the API is the source of truth).
 */
describe('create-action scenarios (MSW side of the API parity table)', () => {
  it.each(CREATE_ACTION_CASES.map((c) => [c.name, c] as const))(
    '%s',
    async (_name, scenario: CreateActionCase) => {
      const vehicle = buildVehicle({ id: 1, daysInStock: scenario.vehicle.ageDays });
      const prior = Array.from({ length: scenario.priorActions ?? 0 }, (_, i) =>
        buildActionEntry({
          id: i + 1,
          vehicleId: vehicle.id,
          loggedAt: `2026-10-0${i + 1}T09:00:00.000Z`,
        }),
      );
      const store = createActionStore({
        vehicles: [vehicle],
        dealerships: [buildDealership()],
        baseActions: prior,
      });
      server.use(logActionHandler(store));
      const { contentType, payload } = caseRequest(scenario);

      const response = await fetch(apiUrl(`/vehicles/${scenario.pathId ?? vehicle.id}/actions`), {
        method: 'POST',
        headers: contentType ? { 'Content-Type': contentType } : {},
        body: payload,
      });
      const body: unknown = await response.json();

      const { expected } = scenario;
      expect(response.status).toBe(expected.status);
      if (expected.code) {
        const { error } = ApiErrorSchema.parse(body);
        expect(error.code).toBe(expected.code);
        if (expected.status === 400) expect(error.details).toBeDefined();
      }
      if (expected.entry) {
        expect(ActionEntrySchema.parse(body)).toMatchObject({
          vehicleId: vehicle.id,
          ...expected.entry,
        });
      }
      expect(store.history(vehicle.id)).toHaveLength(expected.storedCount);
    },
  );
});

describe('mock action store', () => {
  it('assigns the next id and the mock clock instant (TA-12, TA-13)', () => {
    const vehicle = buildVehicle({ id: 7, daysInStock: 120 });
    const store = createActionStore({
      vehicles: [vehicle],
      dealerships: [buildDealership()],
      baseActions: fixtureActions,
    });

    const outcome = store.log('7', EXAMPLE_ACTION_BODY);

    expect(outcome).toEqual({
      status: 201,
      body: {
        id: Math.max(...fixtureActions.map((a) => a.id)) + 1,
        vehicleId: 7,
        ...EXAMPLE_ACTION_BODY,
        loggedAt: MOCK_NOW,
      },
    });
  });

  it('orders same-instant entries by id, newest first, and re-derives the current action', () => {
    const vehicle = buildVehicle({ id: 1, daysInStock: 120 });
    const store = createActionStore({ vehicles: [vehicle], dealerships: [buildDealership()] });

    store.log('1', { ...EXAMPLE_ACTION_BODY, status: 'Under Review' });
    store.log('1', { ...EXAMPLE_ACTION_BODY, status: 'Marketing Promotion' });

    expect(store.history(1).map((a) => [a.id, a.status])).toEqual([
      [2, 'Marketing Promotion'],
      [1, 'Under Review'],
    ]);
    expect(store.vehicles()[0]).toMatchObject({
      needsAttention: false,
      currentAction: { status: 'Marketing Promotion' },
    });
    store.reset();
    expect(store.history(1)).toEqual([]);
    expect(store.vehicles()[0]).toEqual(vehicle);
  });

  it('returns undefined detail for an unknown vehicle or a vehicle without its dealership', () => {
    const store = createActionStore({
      vehicles: [buildVehicle({ id: 1, dealershipId: 9 })],
      dealerships: [buildDealership({ id: 1 })],
    });

    expect(store.detail(2)).toBeUndefined();
    expect(store.detail(1)).toBeUndefined();
  });
});

describe('default handlers: vehicle detail and log action (T-025..T-027)', () => {
  const detailUrl = (id: number | string) => apiUrl(`/vehicles/${id}`);
  const actionsUrl = (id: number | string) => apiUrl(`/vehicles/${id}/actions`);
  const post = (id: number | string, body: unknown) =>
    fetchJson(actionsUrl(id), ActionEntrySchema, { method: 'POST', body: JSON.stringify(body) });
  const getDetail = (id: number | string) => fetchJson(detailUrl(id), VehicleDetailSchema);

  // Dealership 1: vehicle 2 is 194 days without an action; vehicle 30 is 26 days old.
  const agingWithoutAction = 2;
  const nonAging = 30;

  it('fixtures cover the AC-007.4, AC-006.8 and AC-006.2 histories', async () => {
    const two = await getDetail(FIXTURE_HISTORY_VEHICLES.twoEntries);
    const markup = await getDetail(FIXTURE_HISTORY_VEHICLES.markupNote);
    const fresh = await getDetail(FIXTURE_HISTORY_VEHICLES.nonAging);

    expect(two.actions.map((a) => [a.loggedAt, a.status])).toEqual([
      ['2026-10-07T11:00:00.000Z', 'Marketing Promotion'],
      ['2026-10-07T09:00:00.000Z', 'Under Review'],
    ]);
    expect(two.currentAction?.status).toBe('Marketing Promotion');
    expect(two).toMatchObject({ currency: 'GBP', timeZone: 'Europe/London' });
    expect(markup.actions[0]?.note).toBe('<b>cut</b>');
    expect(fresh).toMatchObject({ daysInStock: 45, isAging: false, needsAttention: false });
    expect(fresh.actions).toHaveLength(1);
  });

  it('serves the list item fields unchanged in the detail', async () => {
    expect(await getDetail(agingWithoutAction)).toEqual({
      ...fixtureVehicles.find((v) => v.id === agingWithoutAction),
      currency: 'GBP',
      timeZone: 'Europe/London',
      actions: [],
    });
  });

  it('logs an action: 201, on top of the history, and the list and KPIs follow (AC-006.3, AC-010.2)', async () => {
    const summaryBefore = await fetchJson(apiUrl('/dealerships/1/summary'), InventorySummarySchema);

    const entry = await post(agingWithoutAction, {
      ...EXAMPLE_ACTION_BODY,
      loggedBy: ' Jane Smith ',
    });

    expect(entry).toMatchObject({ vehicleId: agingWithoutAction, ...EXAMPLE_ACTION_BODY });
    expect((await getDetail(agingWithoutAction)).actions).toEqual([entry]);
    const list = await fetchJson(
      apiUrl('/dealerships/1/vehicles?pageSize=100'),
      VehicleListResponseSchema,
    );
    expect(list.items.find((v) => v.id === agingWithoutAction)).toMatchObject({
      needsAttention: false,
      currentAction: { status: 'Price Reduction Planned', loggedBy: 'Jane Smith' },
    });
    const summaryAfter = await fetchJson(apiUrl('/dealerships/1/summary'), InventorySummarySchema);
    expect(summaryAfter.needsAttentionCount).toBe(summaryBefore.needsAttentionCount - 1);
  });

  it('starts every test from the fixture history (reset hook)', () => {
    expect(mockActionStore.appended()).toEqual([]);
    expect(mockActionStore.vehicles()).toEqual(fixtureVehicles);
  });

  it.each([
    [
      '422 VEHICLE_NOT_AGING for a non-aging vehicle',
      nonAging,
      EXAMPLE_ACTION_BODY,
      422,
      'VEHICLE_NOT_AGING',
    ],
    ['404 for an unknown vehicle', 999_999, EXAMPLE_ACTION_BODY, 404, 'NOT_FOUND'],
    [
      '400 for a blank name',
      agingWithoutAction,
      { ...EXAMPLE_ACTION_BODY, loggedBy: '  ' },
      400,
      'VALIDATION_ERROR',
    ],
    ['400 for an invalid id', 'abc', EXAMPLE_ACTION_BODY, 400, 'VALIDATION_ERROR'],
  ] as const)('mirrors the API: %s, storing nothing', async (_label, id, body, status, code) => {
    await expect(post(id, body)).rejects.toMatchObject({
      status,
      code,
    } satisfies Partial<HttpError>);
    expect(mockActionStore.appended()).toEqual([]);
  });

  it('rejects a missing or malformed body with 400', async () => {
    await expect(
      fetchJson(actionsUrl(agingWithoutAction), ActionEntrySchema, { method: 'POST' }),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
    await expect(
      fetchJson(actionsUrl(agingWithoutAction), ActionEntrySchema, {
        method: 'POST',
        body: '{"status":',
      }),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
  });

  it('mirrors the detail errors: 404 unknown vehicle, 400 invalid id', async () => {
    await expect(getDetail(999_999)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    } satisfies Partial<HttpError>);
    await expect(getDetail('1e0')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    } satisfies Partial<HttpError>);
  });
});
