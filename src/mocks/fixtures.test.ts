import { DealershipListResponseSchema } from '@shared/api/dealerships';
import { VehicleListResponseSchema } from '@shared/api/vehicles';
import { http, HttpResponse } from 'msw';
import { apiUrl, fetchJson, type HttpError } from '@/lib/http';
import {
  buildDealership,
  buildVehicle,
  buildVehiclePage,
  buildVehicles,
  fixtureDealerships,
  fixtureVehicles,
} from '@/mocks/fixtures';
import { server } from '@/mocks/server';

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
  });

  it('can be overridden per test', async () => {
    server.use(http.get(apiUrl('/dealerships'), () => HttpResponse.json({ items: [] })));

    await expect(fetchJson(apiUrl('/dealerships'), DealershipListResponseSchema)).resolves.toEqual({
      items: [],
    });
  });
});
