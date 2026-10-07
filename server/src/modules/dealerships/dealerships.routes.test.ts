import { DealershipListResponseSchema } from '@shared/api/dealerships';
import { insertDealership } from '../../../test/factories';
import { createTestApp } from '../../../test/helpers';
import { createDealershipsRepository } from './dealerships.repository';

type TestApp = Awaited<ReturnType<typeof createTestApp>>;
let ctx: TestApp;

beforeEach(async () => {
  ctx = await createTestApp({ today: '2026-10-07' });
});
afterEach(() => ctx.close());

describe('GET /api/dealerships', () => {
  it('returns every dealership sorted by name A-Z (AC-008.1)', async () => {
    insertDealership(ctx.db, { name: 'York Pop-up Showroom' });
    insertDealership(ctx.db, { name: 'Birmingham Central Motors' });
    insertDealership(ctx.db, { name: 'Leeds Northside Cars', timeZone: 'Europe/Dublin' });

    const response = await ctx.app.inject({ method: 'GET', url: '/api/dealerships' });

    expect(response.statusCode).toBe(200);
    const body = DealershipListResponseSchema.parse(response.json());
    expect(body.items.map((d) => d.name)).toEqual([
      'Birmingham Central Motors',
      'Leeds Northside Cars',
      'York Pop-up Showroom',
    ]);
    expect(body.items[1]).toEqual({
      id: expect.any(Number),
      name: 'Leeds Northside Cars',
      currency: 'GBP',
      timeZone: 'Europe/Dublin',
    });
  });

  it('returns an empty list when there are no dealerships', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/dealerships' });

    expect(response.statusCode).toBe(200);
    expect(DealershipListResponseSchema.parse(response.json())).toEqual({ items: [] });
  });

  it('is documented in the OpenAPI spec', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/docs/json' });
    expect(response.json()).toHaveProperty(['paths', '/api/dealerships', 'get']);
  });
});

describe('dealerships repository findById', () => {
  it('returns the dealership or undefined', () => {
    const id = insertDealership(ctx.db, { name: 'Manchester Quays Autos' });
    const repository = createDealershipsRepository(ctx.db);

    expect(repository.findById(id)).toEqual({
      id,
      name: 'Manchester Quays Autos',
      currency: 'GBP',
      timeZone: 'Europe/London',
    });
    expect(repository.findById(id + 100)).toBeUndefined();
  });
});
