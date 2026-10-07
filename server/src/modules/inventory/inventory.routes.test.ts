import { ApiErrorSchema } from '@shared/api/common';
import { VehicleListResponseSchema } from '@shared/api/vehicles';
import { insertAction, insertDealership, insertVehicle } from '../../../test/factories';
import { createTestApp } from '../../../test/helpers';

type TestApp = Awaited<ReturnType<typeof createTestApp>>;
let ctx: TestApp;
let dealershipId: number;

beforeEach(async () => {
  ctx = await createTestApp({ today: '2026-10-07' });
  dealershipId = insertDealership(ctx.db, { name: 'Dealership A' });
});
afterEach(() => ctx.close());

async function list(query = '', id: number | string = dealershipId) {
  const response = await ctx.app.inject({
    method: 'GET',
    url: `/api/dealerships/${id}/vehicles${query}`,
  });
  return response;
}
async function listOk(query = '', id: number | string = dealershipId) {
  const response = await list(query, id);
  expect(response.statusCode).toBe(200);
  return VehicleListResponseSchema.parse(response.json());
}

describe('GET /api/dealerships/:dealershipId/vehicles', () => {
  it('returns every list field (AC-001.1)', async () => {
    insertVehicle(ctx.db, {
      dealershipId,
      vin: '1FADP3F2XJL123456',
      stockNumber: 'STK-1042',
      make: 'Ford',
      model: 'Focus',
      modelYear: 2018,
      trim: 'Titanium',
      colour: 'Blue',
      mileage: 12_345,
      listPriceMinor: 2_599_000,
      stockInDate: '2026-06-01',
    });

    const body = await listOk();

    expect(body).toEqual({
      items: [
        {
          id: expect.any(Number),
          dealershipId,
          vin: '1FADP3F2XJL123456',
          stockNumber: 'STK-1042',
          make: 'Ford',
          model: 'Focus',
          modelYear: 2018,
          trim: 'Titanium',
          colour: 'Blue',
          mileage: 12_345,
          listPriceMinor: 2_599_000,
          stockInDate: '2026-06-01',
          daysInStock: 128,
          isAging: true,
          needsAttention: true,
          currentAction: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    });
  });

  it('only returns the selected dealership (AC-001.2, BR-04)', async () => {
    const other = insertDealership(ctx.db, { name: 'Dealership B' });
    for (let i = 0; i < 12; i++) insertVehicle(ctx.db, { dealershipId, ageDays: i });
    const otherIds = Array.from({ length: 8 }, (_, i) =>
      insertVehicle(ctx.db, { dealershipId: other, ageDays: i }),
    );

    const body = await listOk();

    expect(body.total).toBe(12);
    expect(body.items).toHaveLength(12);
    expect(body.items.every((v) => v.dealershipId === dealershipId)).toBe(true);
    expect(body.items.some((v) => otherIds.includes(v.id))).toBe(false);
    expect((await listOk('', other)).total).toBe(8);
  });

  it('sorts by age desc, ties by stock number asc (AC-001.3, BR-17)', async () => {
    insertVehicle(ctx.db, { dealershipId, ageDays: 10, stockNumber: 'STK-0001' });
    insertVehicle(ctx.db, { dealershipId, ageDays: 200, stockNumber: 'STK-0002' });
    insertVehicle(ctx.db, { dealershipId, ageDays: 95, stockNumber: 'STK-0003' });
    insertVehicle(ctx.db, { dealershipId, ageDays: 95, stockNumber: 'STK-0000' });

    const body = await listOk();

    expect(body.items.map((v) => [v.daysInStock, v.stockNumber])).toEqual([
      [200, 'STK-0002'],
      [95, 'STK-0000'],
      [95, 'STK-0003'],
      [10, 'STK-0001'],
    ]);
  });

  it('flags 91 days as aging and 90 as not (AC-003.1, AC-003.2)', async () => {
    insertVehicle(ctx.db, { dealershipId, stockInDate: '2026-07-09' });
    insertVehicle(ctx.db, { dealershipId, stockInDate: '2026-07-08' });
    insertVehicle(ctx.db, { dealershipId, stockInDate: '2026-10-07' });

    const body = await listOk();

    expect(body.items.map((v) => [v.daysInStock, v.isAging])).toEqual([
      [91, true],
      [90, false],
      [0, false],
    ]);
  });

  it('pages 25 at a time with the real total (AC-001.4, TA-05)', async () => {
    for (let i = 0; i < 30; i++) insertVehicle(ctx.db, { dealershipId, ageDays: i });

    const first = await listOk();
    const second = await listOk('?page=2');
    const pastEnd = await listOk('?page=3');
    const small = await listOk('?pageSize=10&page=3');

    expect([first.items.length, first.total, first.page, first.pageSize]).toEqual([25, 30, 1, 25]);
    expect([second.items.length, second.total, second.page]).toEqual([5, 30, 2]);
    expect([pastEnd.items, pastEnd.total]).toEqual([[], 30]);
    expect(small.items.map((v) => v.daysInStock)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    const ids = [...first.items, ...second.items].map((v) => v.id);
    expect(new Set(ids).size).toBe(30);
  });

  it('shows the latest action as current; equal timestamps fall back to id (AC-007.4, BR-14)', async () => {
    const twoTimes = insertVehicle(ctx.db, { dealershipId, ageDays: 200, stockNumber: 'STK-1' });
    const sameTime = insertVehicle(ctx.db, { dealershipId, ageDays: 150, stockNumber: 'STK-2' });
    insertVehicle(ctx.db, { dealershipId, ageDays: 100, stockNumber: 'STK-3' });
    insertAction(ctx.db, {
      vehicleId: twoTimes,
      status: 'Marketing Promotion',
      loggedAt: '2026-10-05T10:00:00.000Z',
    });
    insertAction(ctx.db, {
      vehicleId: twoTimes,
      status: 'Under Review',
      loggedAt: '2026-10-05T08:00:00.000Z',
    });
    insertAction(ctx.db, {
      vehicleId: sameTime,
      status: 'Under Review',
      loggedAt: '2026-10-07T12:00:00.000Z',
    });
    insertAction(ctx.db, {
      vehicleId: sameTime,
      status: 'Send to Auction/Wholesale',
      loggedBy: 'Tom Hughes',
      loggedAt: '2026-10-07T12:00:00.000Z',
    });

    const { items } = await listOk();

    expect(items.map((v) => v.currentAction)).toEqual([
      {
        status: 'Marketing Promotion',
        loggedBy: 'Jane Smith',
        loggedAt: '2026-10-05T10:00:00.000Z',
      },
      {
        status: 'Send to Auction/Wholesale',
        loggedBy: 'Tom Hughes',
        loggedAt: '2026-10-07T12:00:00.000Z',
      },
      null,
    ]);
    expect(items.map((v) => v.needsAttention)).toEqual([false, false, true]);
  });

  it('returns an empty first page for a dealership with no vehicles (AC-001.5)', async () => {
    const empty = insertDealership(ctx.db, { name: 'York Pop-up Showroom' });
    insertVehicle(ctx.db, { dealershipId, ageDays: 100 });

    const body = await listOk('', empty);

    expect(body).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
  });

  it('returns 404 NOT_FOUND for an unknown dealership', async () => {
    const response = await list('', 9999);

    expect(response.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(response.json()).error.code).toBe('NOT_FOUND');
  });

  it.each([
    ['pageSize=101', '?pageSize=101', dealershipId],
    ['page=0', '?page=0', dealershipId],
    ['unknown sort', '?sort=vin', dealershipId],
  ])('returns 400 VALIDATION_ERROR for %s', async (_label, query) => {
    const response = await list(query);

    expect(response.statusCode).toBe(400);
    expect(ApiErrorSchema.parse(response.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it.each(['abc', '0x1', '1e2'])(
    'returns 400 VALIDATION_ERROR for the non-canonical dealershipId %s',
    async (id) => {
      const response = await list('', id);

      expect(response.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(response.json()).error.code).toBe('VALIDATION_ERROR');
    },
  );

  it.each(['?page=1e2', '?page=0x1', '?pageSize=1.5', '?page=-1'])(
    'returns 400 VALIDATION_ERROR for the non-canonical query %s',
    async (query) => {
      const response = await list(query);

      expect(response.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(response.json()).error.code).toBe('VALIDATION_ERROR');
    },
  );

  it('is documented in the OpenAPI spec', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/docs/json' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty([
      'paths',
      '/api/dealerships/{dealershipId}/vehicles',
      'get',
    ]);
    const parameters = (
      response.json() as {
        paths: Record<string, { get: { parameters: { name: string; schema: unknown }[] } }>;
      }
    ).paths['/api/dealerships/{dealershipId}/vehicles']?.get.parameters;
    expect(parameters?.find((p) => p.name === 'pageSize')?.schema).toMatchObject({
      default: 25,
      anyOf: [
        { type: 'integer', maximum: 100 },
        { type: 'string', pattern: '^\\d+$' },
      ],
    });
  });
});
