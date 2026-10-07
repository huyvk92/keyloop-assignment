import { DealershipListResponseSchema } from '@shared/api/dealerships';
import {
  FacetsResponseSchema,
  VehicleListQuerySchema,
  VehicleListResponseSchema,
} from '@shared/api/vehicles';
import { http, HttpResponse } from 'msw';
import { apiUrl, fetchJson, type HttpError } from '@/lib/http';
import {
  buildCurrentAction,
  buildDealership,
  buildFacets,
  buildVehicle,
  buildVehiclePage,
  buildVehicles,
  fixtureDealerships,
  fixtureVehicles,
} from '@/mocks/fixtures';
import { server } from '@/mocks/server';
import { queryVehicles } from '@/mocks/vehicle-query';

describe('fixtures', () => {
  it('builds a schema-valid dealership with overrides', () => {
    expect(buildDealership({ id: 9, name: 'Derby' })).toEqual({
      id: 9,
      name: 'Derby',
      currency: 'GBP',
      timeZone: 'Europe/London',
    });
  });

  it('builds a schema-valid vehicle and derives age-dependent fields', () => {
    const fresh = buildVehicle({ daysInStock: 90 });
    const aging = buildVehicle({ daysInStock: 91 });

    expect(fresh).toMatchObject({ isAging: false, needsAttention: false, currentAction: null });
    expect(fresh.vin).toHaveLength(17);
    expect(aging).toMatchObject({ isAging: true, needsAttention: true });
    expect(aging.stockInDate).toBe('2026-07-08');
  });

  it('does not flag an aging vehicle with a current action as needing attention', () => {
    const vehicle = buildVehicle({
      daysInStock: 120,
      currentAction: {
        status: 'Under Review',
        loggedBy: 'Jane Smith',
        loggedAt: '2026-10-07T09:00:00.000Z',
      },
    });

    expect(vehicle).toMatchObject({ isAging: true, needsAttention: false });
  });

  it('rejects overrides that break the contract', () => {
    expect(() => buildVehicle({ vin: 'TOO-SHORT' })).toThrow();
    expect(() => buildDealership({ currency: 'POUNDS' })).toThrow();
  });

  it('builds unique vehicles ordered oldest first', () => {
    const vehicles = buildVehicles(5, { dealershipId: 3, startId: 100 });

    expect(new Set(vehicles.map((v) => v.vin)).size).toBe(5);
    expect(vehicles.map((v) => v.id)).toEqual([100, 101, 102, 103, 104]);
    expect(vehicles.every((v) => v.dealershipId === 3)).toBe(true);
    const ages = vehicles.map((v) => v.daysInStock);
    expect(ages).toEqual([...ages].sort((a, b) => b - a));
  });

  it('builds a page slice with the real total, empty past the end', () => {
    const vehicles = buildVehicles(30);

    expect(buildVehiclePage(vehicles, { page: 2, pageSize: 25 })).toMatchObject({
      total: 30,
      page: 2,
      pageSize: 25,
      items: vehicles.slice(25),
    });
    expect(buildVehiclePage(vehicles, { page: 3 }).items).toEqual([]);
    expect(() => VehicleListResponseSchema.parse(buildVehiclePage(vehicles))).not.toThrow();
  });

  it('ships a default data set matching the seed shape (York has no vehicles)', () => {
    expect(fixtureDealerships.map((d) => d.name)).toEqual([
      'Birmingham',
      'Leeds',
      'Manchester',
      'York',
    ]);
    expect(fixtureVehicles.filter((v) => v.dealershipId === 1)).toHaveLength(30);
    expect(fixtureVehicles.filter((v) => v.dealershipId === 4)).toHaveLength(0);
  });
});

describe('default handlers', () => {
  const vehiclesUrl = (id: number | string, search = '') =>
    apiUrl(`/dealerships/${id}/vehicles${search}`);

  it('serves the dealership list', async () => {
    const body = await fetchJson(apiUrl('/dealerships'), DealershipListResponseSchema);

    expect(body.items).toEqual(fixtureDealerships);
  });

  it('pages vehicles with the default page size', async () => {
    const page1 = await fetchJson(vehiclesUrl(1), VehicleListResponseSchema);
    const page2 = await fetchJson(vehiclesUrl(1, '?page=2'), VehicleListResponseSchema);

    expect(page1).toMatchObject({ total: 30, page: 1, pageSize: 25 });
    expect(page1.items).toHaveLength(25);
    expect(page2.items).toHaveLength(5);
  });

  it('honours pageSize and returns an empty page past the end', async () => {
    const small = await fetchJson(vehiclesUrl(1, '?pageSize=10&page=3'), VehicleListResponseSchema);
    const past = await fetchJson(vehiclesUrl(1, '?page=9'), VehicleListResponseSchema);

    expect(small.items.map((v) => v.id)).toEqual(
      fixtureVehicles
        .filter((v) => v.dealershipId === 1)
        .slice(20, 30)
        .map((v) => v.id),
    );
    expect(past).toMatchObject({ items: [], total: 30, page: 9 });
  });

  it('filters before paging, so the total counts the matches (AC-002.1)', async () => {
    const body = await fetchJson(
      vehiclesUrl(1, '?make=Ford&pageSize=2'),
      VehicleListResponseSchema,
    );

    expect(body.total).toBe(6);
    expect(body.items.map((v) => v.make)).toEqual(['Ford', 'Ford']);
  });

  it('returns an empty list for a dealership without stock', async () => {
    const body = await fetchJson(vehiclesUrl(4), VehicleListResponseSchema);

    expect(body).toMatchObject({ items: [], total: 0 });
  });

  it('mirrors the API errors: 404 unknown dealership, 400 invalid input', async () => {
    await expect(fetchJson(vehiclesUrl(99), VehicleListResponseSchema)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    } satisfies Partial<HttpError>);
    await expect(fetchJson(vehiclesUrl('abc'), VehicleListResponseSchema)).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    } satisfies Partial<HttpError>);
    await expect(
      fetchJson(vehiclesUrl(1, '?pageSize=101'), VehicleListResponseSchema),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
    await expect(
      fetchJson(vehiclesUrl(1, '?minAge=100&maxAge=50'), VehicleListResponseSchema),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
    await expect(
      fetchJson(vehiclesUrl(1, '?make=Ford&make=BMW'), VehicleListResponseSchema),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
  });

  it('ignores a repeated unknown query key, like the API (TA-27)', async () => {
    const body = await fetchJson(vehiclesUrl(1, '?utm=1&utm=2'), VehicleListResponseSchema);

    expect(body.total).toBe(fixtureVehicles.filter((v) => v.dealershipId === 1).length);
  });

  it('can be overridden per test', async () => {
    server.use(http.get(apiUrl('/dealerships'), () => HttpResponse.json({ items: [] })));

    await expect(fetchJson(apiUrl('/dealerships'), DealershipListResponseSchema)).resolves.toEqual({
      items: [],
    });
  });
});

describe('mock filtering and sorting (parity with the API, T-015)', () => {
  const ages = [30, 31, 60, 61, 90, 91];
  const aged = ages.map((daysInStock, index) =>
    buildVehicle({ id: index + 1, stockNumber: `STK-${2000 + index}`, daysInStock }),
  );
  const run = (input: Record<string, string>) =>
    queryVehicles(aged, VehicleListQuerySchema.parse(input)).map((v) => v.daysInStock);

  it('applies inclusive buckets (AC-002.3)', () => {
    expect(run({ ageBucket: '31-60' })).toEqual([60, 31]);
    expect(run({ ageBucket: 'over-90' })).toEqual([91]);
    expect(run({ ageBucket: '0-30' })).toEqual([30]);
  });

  it('intersects bucket, range and agingOnly; an empty intersection gives no rows (TA-07)', () => {
    expect(run({ minAge: '45', maxAge: '90' })).toEqual([90, 61, 60]);
    expect(run({ ageBucket: '61-90', minAge: '62' })).toEqual([90]);
    expect(run({ ageBucket: '0-30', agingOnly: 'true' })).toEqual([]);
    expect(run({ agingOnly: 'false' })).toHaveLength(6);
  });

  it('matches make/model exactly and needsAttention as aging without an action (BR-16)', () => {
    const ford = buildVehicle({ id: 10, daysInStock: 120 });
    const fordWithAction = buildVehicle({
      id: 20,
      daysInStock: 120,
      currentAction: buildCurrentAction(),
    });
    const vehicles = [ford, fordWithAction, buildVehicle({ id: 11, daysInStock: 120 })];
    const ids = (input: Record<string, string>) =>
      queryVehicles(vehicles, VehicleListQuerySchema.parse(input)).map((v) => v.id);

    expect(ids({ make: 'Ford' })).toEqual([10, 20]);
    expect(ids({ make: 'ford' })).toEqual([]);
    expect(ids({ make: 'Ford', model: 'Focus' })).toEqual([10, 20]);
    expect(ids({ needsAttention: 'true' })).toEqual([10, 11]);
  });

  it('searches VIN, stock number and model as a literal, case-insensitive substring (BR-08)', () => {
    const vehicles = [
      buildVehicle({ id: 1, stockNumber: 'STK-1042', vin: '1FADP3F2XJL123456' }),
      buildVehicle({ id: 2, stockNumber: 'STK-100%' }),
      buildVehicle({ id: 3, model: 'Focus' }),
    ];
    const ids = (q: string) =>
      queryVehicles(vehicles, VehicleListQuerySchema.parse({ q })).map((v) => v.id);

    expect(ids(' stk-104 ')).toEqual([1]);
    expect(ids('123456')).toEqual([1]);
    expect(ids('%')).toEqual([2]);
    expect(ids('FOCUS')).toEqual([3]);
  });

  it('sorts by age, price and make/model (case-insensitive) with a stock-number tie-break', () => {
    const vehicles = [
      buildVehicle({
        id: 1,
        stockNumber: 'STK-3',
        make: 'Hyundai',
        model: 'Tucson',
        listPriceMinor: 300,
        daysInStock: 10,
      }),
      buildVehicle({
        id: 2,
        stockNumber: 'STK-2',
        make: 'Hyundai',
        model: 'i10',
        listPriceMinor: 100,
        daysInStock: 50,
      }),
      buildVehicle({
        id: 3,
        stockNumber: 'STK-1',
        make: 'audi',
        model: 'A3',
        listPriceMinor: 100,
        daysInStock: 50,
      }),
    ];
    const ids = (input: Record<string, string>) =>
      queryVehicles(vehicles, VehicleListQuerySchema.parse(input)).map((v) => v.id);

    expect(ids({})).toEqual([3, 2, 1]);
    expect(ids({ order: 'asc' })).toEqual([1, 3, 2]);
    expect(ids({ sort: 'price' })).toEqual([3, 2, 1]);
    expect(ids({ sort: 'price', order: 'desc' })).toEqual([1, 3, 2]);
    expect(ids({ sort: 'makeModel' })).toEqual([3, 2, 1]);
    expect(ids({ sort: 'makeModel', order: 'desc' })).toEqual([1, 2, 3]);
  });
});

describe('facets', () => {
  const facetsUrl = (id: number | string) => apiUrl(`/dealerships/${id}/facets`);

  it('builds distinct makes and models A-Z, case-insensitively (TA-27)', () => {
    const facets = buildFacets([
      buildVehicle({ id: 1, make: 'Hyundai', model: 'Tucson' }),
      buildVehicle({ id: 2, make: 'Hyundai', model: 'i10' }),
      buildVehicle({ id: 3, make: 'Hyundai', model: 'i10' }),
      buildVehicle({ id: 4, make: 'audi', model: 'A3' }),
    ]);

    expect(facets).toEqual({
      makes: [
        { make: 'audi', models: ['A3'] },
        { make: 'Hyundai', models: ['i10', 'Tucson'] },
      ],
    });
  });

  it('serves the dealership facets, empty for a dealership without stock', async () => {
    const leeds = await fetchJson(facetsUrl(2), FacetsResponseSchema);
    const york = await fetchJson(facetsUrl(4), FacetsResponseSchema);

    expect(leeds).toEqual(buildFacets(fixtureVehicles.filter((v) => v.dealershipId === 2)));
    expect(york).toEqual({ makes: [] });
  });

  it('mirrors the API errors: 404 unknown dealership, 400 invalid id', async () => {
    await expect(fetchJson(facetsUrl(99), FacetsResponseSchema)).rejects.toMatchObject({
      status: 404,
    } satisfies Partial<HttpError>);
    await expect(fetchJson(facetsUrl('abc'), FacetsResponseSchema)).rejects.toMatchObject({
      status: 400,
    } satisfies Partial<HttpError>);
  });
});
