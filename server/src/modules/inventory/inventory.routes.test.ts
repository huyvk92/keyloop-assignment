import { ApiErrorSchema } from '@shared/api/common';
import { FacetsResponseSchema, VehicleListResponseSchema } from '@shared/api/vehicles';
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

describe('GET /api/dealerships/:dealershipId/vehicles filters, search and sort (T-015)', () => {
  const stockNumbers = (body: { items: { stockNumber: string }[] }) =>
    body.items.map((v) => v.stockNumber);
  const ages = (body: { items: { daysInStock: number }[] }) => body.items.map((v) => v.daysInStock);

  it('make=Ford lists only Ford and updates the count (AC-002.1)', async () => {
    insertVehicle(ctx.db, { dealershipId, make: 'Ford', model: 'Focus', ageDays: 5 });
    insertVehicle(ctx.db, { dealershipId, make: 'Ford', model: 'Puma', ageDays: 4 });
    insertVehicle(ctx.db, { dealershipId, make: 'Toyota', model: 'Yaris', ageDays: 3 });
    const other = insertDealership(ctx.db);
    insertVehicle(ctx.db, { dealershipId: other, make: 'Ford' });

    const body = await listOk('?make=Ford');

    expect(body.total).toBe(2);
    expect(body.items.map((v) => [v.make, v.model])).toEqual([
      ['Ford', 'Focus'],
      ['Ford', 'Puma'],
    ]);
    expect((await listOk('?make=Ford&model=Puma')).items.map((v) => v.model)).toEqual(['Puma']);
    expect((await listOk('?make=Toyota&model=Puma')).total).toBe(0);
  });

  it('applies the inclusive age buckets at 30/31/60/61/90/91 (AC-002.3, BR-07)', async () => {
    for (const ageDays of [91, 90, 61, 60, 31, 30])
      insertVehicle(ctx.db, { dealershipId, ageDays });

    expect(ages(await listOk('?ageBucket=0-30'))).toEqual([30]);
    expect(ages(await listOk('?ageBucket=31-60'))).toEqual([60, 31]);
    expect(ages(await listOk('?ageBucket=61-90'))).toEqual([90, 61]);
    expect(ages(await listOk('?ageBucket=over-90'))).toEqual([91]);
  });

  it('keeps a future-dated vehicle (age 0) in 0-30 (TA-22)', async () => {
    insertVehicle(ctx.db, { dealershipId, stockInDate: '2026-10-09' });

    const body = await listOk('?ageBucket=0-30');

    expect(body.items.map((v) => [v.stockInDate, v.daysInStock])).toEqual([['2026-10-09', 0]]);
  });

  it('combines make and over-90 with AND (AC-002.5, BR-05)', async () => {
    insertVehicle(ctx.db, { dealershipId, make: 'Ford', ageDays: 91, stockNumber: 'STK-0001' });
    insertVehicle(ctx.db, { dealershipId, make: 'Ford', ageDays: 30, stockNumber: 'STK-0002' });
    insertVehicle(ctx.db, { dealershipId, make: 'Toyota', ageDays: 120, stockNumber: 'STK-0003' });

    const body = await listOk('?make=Ford&ageBucket=over-90');

    expect([stockNumbers(body), body.total]).toEqual([['STK-0001'], 1]);
  });

  it('applies a custom range 45-90 inclusively (AC-002.4)', async () => {
    for (const ageDays of [44, 45, 60, 90, 91]) insertVehicle(ctx.db, { dealershipId, ageDays });

    expect(ages(await listOk('?minAge=45&maxAge=90'))).toEqual([90, 60, 45]);
    expect(ages(await listOk('?minAge=91'))).toEqual([91]);
    expect(ages(await listOk('?maxAge=44'))).toEqual([44]);
  });

  it('returns 0 rows, not an error, for an empty bucket/range intersection (TA-07)', async () => {
    insertVehicle(ctx.db, { dealershipId, ageDays: 20 });
    insertVehicle(ctx.db, { dealershipId, ageDays: 100 });

    expect(await listOk('?ageBucket=0-30&agingOnly=true')).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    });
    expect((await listOk('?ageBucket=31-60&minAge=70')).total).toBe(0);
  });

  it('returns 400 for min > max on maxAge, and accepts min = max (AC-002.4)', async () => {
    insertVehicle(ctx.db, { dealershipId, ageDays: 60 });

    const response = await list('?minAge=100&maxAge=50');

    expect(response.statusCode).toBe(400);
    const { error } = ApiErrorSchema.parse(response.json());
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(error.details)).toContain('maxAge');
    expect(ages(await listOk('?minAge=60&maxAge=60'))).toEqual([60]);
  });

  it.each([
    ['unknown ageBucket', '?ageBucket=%3E90'],
    ['negative minAge', '?minAge=-1'],
    ['decimal maxAge', '?maxAge=1.5'],
    ['non-canonical minAge', '?minAge=1e2'],
    ['agingOnly not a boolean', '?agingOnly=maybe'],
    ['needsAttention not a boolean', '?needsAttention=2'],
    ['empty q', '?q='],
    ['blank q', '?q=%20%20'],
    ['q over 100 chars', `?q=${'x'.repeat(101)}`],
    ['repeated make', '?make=Ford&make=Toyota'],
    ['unknown order', '?order=up'],
  ])('returns 400 VALIDATION_ERROR for %s', async (_label, query) => {
    const response = await list(query);

    expect(response.statusCode).toBe(400);
    expect(ApiErrorSchema.parse(response.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('ignores a repeated unknown query key, like any unknown key (TA-27)', async () => {
    insertVehicle(ctx.db, { dealershipId, stockNumber: 'STK-0001' });

    expect(stockNumbers(await listOk('?utm=1&utm=2'))).toEqual(['STK-0001']);
  });

  it('matches " stk-104 " and "123456" on stock number and VIN, case-insensitively (AC-002.6, BR-08)', async () => {
    insertVehicle(ctx.db, {
      dealershipId,
      stockNumber: 'STK-1042',
      vin: '1FADP3F2XJL123456',
      model: 'Focus',
    });
    insertVehicle(ctx.db, {
      dealershipId,
      stockNumber: 'STK-2001',
      vin: 'JTDKB20U093000001',
      model: 'Yaris',
    });

    expect(stockNumbers(await listOk('?q=%20stk-104%20'))).toEqual(['STK-1042']);
    expect(stockNumbers(await listOk('?q=123456'))).toEqual(['STK-1042']);
    expect(stockNumbers(await listOk('?q=yARIS'))).toEqual(['STK-2001']);
    expect((await listOk('?q=zzz')).total).toBe(0);
  });

  it('matches %, _ and \\ literally (BR-08 LIKE escaping)', async () => {
    insertVehicle(ctx.db, { dealershipId, model: 'Model 100%', stockNumber: 'STK-0001' });
    insertVehicle(ctx.db, { dealershipId, model: 'Model_X', stockNumber: 'STK-0002' });
    insertVehicle(ctx.db, { dealershipId, model: 'Back\\Slash', stockNumber: 'STK-0003' });
    insertVehicle(ctx.db, { dealershipId, model: 'ModelZX', stockNumber: 'STK-0004' });

    expect(stockNumbers(await listOk('?q=%25'))).toEqual(['STK-0001']);
    expect(stockNumbers(await listOk('?q=l_X'))).toEqual(['STK-0002']);
    expect(stockNumbers(await listOk('?q=%5C'))).toEqual(['STK-0003']);
  });

  it('combines agingOnly with make; agingOnly=false applies no restriction (AC-004.3)', async () => {
    insertVehicle(ctx.db, { dealershipId, make: 'Ford', ageDays: 91, stockNumber: 'STK-0001' });
    insertVehicle(ctx.db, { dealershipId, make: 'Ford', ageDays: 90, stockNumber: 'STK-0002' });
    insertVehicle(ctx.db, { dealershipId, make: 'Toyota', ageDays: 200, stockNumber: 'STK-0003' });

    expect(stockNumbers(await listOk('?agingOnly=true&make=Ford'))).toEqual(['STK-0001']);
    expect(stockNumbers(await listOk('?agingOnly=true'))).toEqual(['STK-0003', 'STK-0001']);
    expect((await listOk('?agingOnly=false')).total).toBe(3);
  });

  it('needsAttention=true lists aging vehicles without an action (AC-010.1, BR-16)', async () => {
    const withAction = insertVehicle(ctx.db, {
      dealershipId,
      ageDays: 150,
      stockNumber: 'STK-0001',
    });
    insertVehicle(ctx.db, { dealershipId, ageDays: 120, stockNumber: 'STK-0002' });
    insertVehicle(ctx.db, { dealershipId, ageDays: 91, stockNumber: 'STK-0003' });
    insertVehicle(ctx.db, { dealershipId, ageDays: 90, stockNumber: 'STK-0004' });
    insertAction(ctx.db, { vehicleId: withAction });

    const body = await listOk('?needsAttention=true');

    expect(stockNumbers(body)).toEqual(['STK-0002', 'STK-0003']);
    expect(body.items.every((v) => v.needsAttention && v.currentAction === null)).toBe(true);
    expect((await listOk('?needsAttention=false')).total).toBe(4);
    expect(stockNumbers(await listOk('?needsAttention=true&maxAge=100'))).toEqual(['STK-0003']);
  });

  it('sorts by price asc, then desc (AC-011.1)', async () => {
    insertVehicle(ctx.db, { dealershipId, listPriceMinor: 3_000_000, stockNumber: 'STK-0001' });
    insertVehicle(ctx.db, { dealershipId, listPriceMinor: 1_000_000, stockNumber: 'STK-0002' });
    insertVehicle(ctx.db, { dealershipId, listPriceMinor: 2_000_000, stockNumber: 'STK-0003' });
    insertVehicle(ctx.db, { dealershipId, listPriceMinor: 1_000_000, stockNumber: 'STK-0000' });

    const asc = await listOk('?sort=price');
    const desc = await listOk('?sort=price&order=desc');

    expect(asc.items.map((v) => [v.listPriceMinor, v.stockNumber])).toEqual([
      [1_000_000, 'STK-0000'],
      [1_000_000, 'STK-0002'],
      [2_000_000, 'STK-0003'],
      [3_000_000, 'STK-0001'],
    ]);
    expect(desc.items.map((v) => [v.listPriceMinor, v.stockNumber])).toEqual([
      [3_000_000, 'STK-0001'],
      [2_000_000, 'STK-0003'],
      [1_000_000, 'STK-0000'],
      [1_000_000, 'STK-0002'],
    ]);
  });

  it('sorts by make, then model, A-Z and Z-A (AC-011.2)', async () => {
    insertVehicle(ctx.db, { dealershipId, make: 'Toyota', model: 'Yaris' });
    insertVehicle(ctx.db, { dealershipId, make: 'Ford', model: 'Puma' });
    insertVehicle(ctx.db, { dealershipId, make: 'BMW', model: 'X1' });
    insertVehicle(ctx.db, { dealershipId, make: 'Ford', model: 'Focus' });

    const az = await listOk('?sort=makeModel');
    const za = await listOk('?sort=makeModel&order=desc');

    expect(az.items.map((v) => `${v.make} ${v.model}`)).toEqual([
      'BMW X1',
      'Ford Focus',
      'Ford Puma',
      'Toyota Yaris',
    ]);
    expect(za.items.map((v) => `${v.make} ${v.model}`)).toEqual([
      'Toyota Yaris',
      'Ford Puma',
      'Ford Focus',
      'BMW X1',
    ]);
  });

  it('sorts make/model alphabetically regardless of case (Hyundai i10 before Tucson)', async () => {
    insertVehicle(ctx.db, { dealershipId, make: 'Hyundai', model: 'Tucson' });
    insertVehicle(ctx.db, { dealershipId, make: 'Hyundai', model: 'i10' });
    insertVehicle(ctx.db, { dealershipId, make: 'MINI', model: 'Hatch' });
    insertVehicle(ctx.db, { dealershipId, make: 'Mercedes-Benz', model: 'A-Class' });

    const az = await listOk('?sort=makeModel');

    expect(az.items.map((v) => `${v.make} ${v.model}`)).toEqual([
      'Hyundai i10',
      'Hyundai Tucson',
      'Mercedes-Benz A-Class',
      'MINI Hatch',
    ]);
  });

  it('sorts by age asc (youngest first) when asked', async () => {
    for (const ageDays of [50, 5, 500]) insertVehicle(ctx.db, { dealershipId, ageDays });

    expect(ages(await listOk('?sort=age&order=asc'))).toEqual([5, 50, 500]);
  });

  it('pages a filtered result with the filtered total', async () => {
    for (let i = 0; i < 12; i++) insertVehicle(ctx.db, { dealershipId, make: 'Ford', ageDays: i });
    for (let i = 0; i < 5; i++) insertVehicle(ctx.db, { dealershipId, make: 'Kia', ageDays: i });

    const second = await listOk('?make=Ford&pageSize=5&page=3');

    expect([second.total, second.items.length, ages(second)]).toEqual([12, 2, [1, 0]]);
  });

  it('documents every filter parameter in the OpenAPI spec', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/docs/json' });

    expect(response.statusCode).toBe(200);
    const parameters = (
      response.json() as {
        paths: Record<string, { get: { parameters: { name: string; in: string }[] } }>;
      }
    ).paths['/api/dealerships/{dealershipId}/vehicles']?.get.parameters;
    expect(parameters?.filter((p) => p.in === 'query').map((p) => p.name)).toEqual([
      'make',
      'model',
      'ageBucket',
      'minAge',
      'maxAge',
      'agingOnly',
      'needsAttention',
      'q',
      'sort',
      'order',
      'page',
      'pageSize',
    ]);
  });
});

describe('GET /api/dealerships/:dealershipId/facets (T-016)', () => {
  async function facets(id: number | string = dealershipId) {
    return ctx.app.inject({ method: 'GET', url: `/api/dealerships/${id}/facets` });
  }

  it('returns distinct makes A-Z, each with its distinct models A-Z (AC-002.2, BR-06)', async () => {
    insertVehicle(ctx.db, { dealershipId, make: 'Toyota', model: 'Yaris' });
    insertVehicle(ctx.db, { dealershipId, make: 'Ford', model: 'Puma' });
    insertVehicle(ctx.db, { dealershipId, make: 'Ford', model: 'Focus' });
    insertVehicle(ctx.db, { dealershipId, make: 'Ford', model: 'Focus' });
    insertVehicle(ctx.db, { dealershipId, make: 'BMW', model: 'X1' });
    insertVehicle(ctx.db, { dealershipId, make: 'Toyota', model: 'Corolla' });

    const response = await facets();

    expect(response.statusCode).toBe(200);
    expect(FacetsResponseSchema.parse(response.json())).toEqual({
      makes: [
        { make: 'BMW', models: ['X1'] },
        { make: 'Ford', models: ['Focus', 'Puma'] },
        { make: 'Toyota', models: ['Corolla', 'Yaris'] },
      ],
    });
  });

  it('sorts makes and models alphabetically regardless of case', async () => {
    insertVehicle(ctx.db, { dealershipId, make: 'MINI', model: 'Hatch' });
    insertVehicle(ctx.db, { dealershipId, make: 'Mercedes-Benz', model: 'GLA' });
    insertVehicle(ctx.db, { dealershipId, make: 'Hyundai', model: 'Tucson' });
    insertVehicle(ctx.db, { dealershipId, make: 'Hyundai', model: 'i10' });

    const body = FacetsResponseSchema.parse((await facets()).json());

    expect(body.makes).toEqual([
      { make: 'Hyundai', models: ['i10', 'Tucson'] },
      { make: 'Mercedes-Benz', models: ['GLA'] },
      { make: 'MINI', models: ['Hatch'] },
    ]);
  });

  it("is scoped to the dealership: no other dealership's makes or models (BR-04, BR-06)", async () => {
    const other = insertDealership(ctx.db, { name: 'Dealership B' });
    insertVehicle(ctx.db, { dealershipId, make: 'Ford', model: 'Focus' });
    insertVehicle(ctx.db, { dealershipId: other, make: 'Ford', model: 'Mustang' });
    insertVehicle(ctx.db, { dealershipId: other, make: 'Kia', model: 'Niro' });

    const body = FacetsResponseSchema.parse((await facets()).json());

    expect(body).toEqual({ makes: [{ make: 'Ford', models: ['Focus'] }] });
  });

  it('returns makes: [] for a dealership with no stock', async () => {
    const response = await facets();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ makes: [] });
  });

  it('returns 404 NOT_FOUND for an unknown dealership', async () => {
    const response = await facets(9999);

    expect(response.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(response.json()).error.code).toBe('NOT_FOUND');
  });

  it.each(['abc', '0', '1e2'])(
    'returns 400 VALIDATION_ERROR for the dealershipId %s',
    async (id) => {
      const response = await facets(id);

      expect(response.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(response.json()).error.code).toBe('VALIDATION_ERROR');
    },
  );

  it('is documented in the OpenAPI spec', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/docs/json' });

    expect(response.json()).toHaveProperty([
      'paths',
      '/api/dealerships/{dealershipId}/facets',
      'get',
    ]);
  });
});
