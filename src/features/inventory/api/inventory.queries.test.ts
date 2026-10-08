import { VehicleListQuerySchema } from '@shared/api/vehicles';
import {
  agingStockOptions,
  facetsOptions,
  getFacets,
  getSummary,
  getVehicles,
  inventoryKeys,
  summaryOptions,
  vehicleListOptions,
} from '@/features/inventory';

describe('inventory queries', () => {
  it('scopes every key under the dealership so one prefix invalidates them all', () => {
    const query = VehicleListQuerySchema.parse({ page: 2 });

    expect(inventoryKeys.dealership(1)).toEqual(['inventory', 1]);
    expect(inventoryKeys.vehicles(1, query)).toEqual(['inventory', 1, 'vehicles', query]);
    expect(inventoryKeys.facets(1)).toEqual(['inventory', 1, 'facets']);
    expect(inventoryKeys.aging(1)).toEqual(['inventory', 1, 'aging']);
    expect(inventoryKeys.summary(1)).toEqual(['inventory', 1, 'summary']);
  });

  it('polls the summary like the list, with no filters in the key and no placeholder (BR-15, BR-04)', () => {
    const options = summaryOptions(1);

    expect(options.queryKey).toEqual(['inventory', 1, 'summary']);
    expect(options.refetchInterval).toBe(60_000);
    expect(options.refetchOnWindowFocus).toBe(true);
    expect(options.placeholderData).toBeUndefined();
  });

  it('fetches and parses the summary', async () => {
    const summary = await getSummary(1);
    const aging = await getVehicles(1, { agingOnly: true });

    expect(summary.totalVehicles).toBe(30);
    expect(summary.agingCount).toBe(aging.total);
  });

  it('polls the aging section like the list, without a cross-dealership placeholder (TA-11, BR-04)', () => {
    const options = agingStockOptions(1);

    expect(options.queryKey).toEqual(['inventory', 1, 'aging']);
    expect(options.refetchInterval).toBe(60_000);
    expect(options.refetchOnWindowFocus).toBe(true);
    expect(options.placeholderData).toBeUndefined();
  });

  it('polls every 60 s, refetches on focus and keeps the previous page while loading (ADR-007)', () => {
    const options = vehicleListOptions(1, VehicleListQuerySchema.parse({}));

    expect(options.refetchInterval).toBe(60_000);
    expect(options.refetchOnWindowFocus).toBe(true);
    expect(options.placeholderData).toBeTypeOf('function');
  });

  it('fetches and parses a page of vehicles', async () => {
    const body = await getVehicles(1, VehicleListQuerySchema.parse({ page: 2 }));

    expect(body).toMatchObject({ page: 2, pageSize: 25, total: 30 });
    expect(body.items).toHaveLength(5);
  });

  it('caches facets for 5 minutes without polling (TRD section 5)', () => {
    const options = facetsOptions(1);

    expect(options.staleTime).toBe(5 * 60_000);
    expect(options.refetchInterval).toBeUndefined();
  });

  it('fetches and parses the facets, and sends filters as query params', async () => {
    const facets = await getFacets(1);
    const fords = await getVehicles(
      1,
      VehicleListQuerySchema.parse({ make: 'Ford', agingOnly: 'true' }),
    );

    expect(facets.makes.find((m) => m.make === 'Ford')?.models).toEqual(['Fiesta', 'Focus']);
    expect(fords.items.every((v) => v.make === 'Ford' && v.isAging)).toBe(true);
    expect(fords.total).toBe(3);
  });
});
