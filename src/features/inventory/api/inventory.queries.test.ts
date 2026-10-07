import { VehicleListQuerySchema } from '@shared/api/vehicles';
import {
  facetsOptions,
  getFacets,
  getVehicles,
  inventoryKeys,
  vehicleListOptions,
} from '@/features/inventory';

describe('inventory queries', () => {
  it('scopes every key under the dealership so one prefix invalidates them all', () => {
    const query = VehicleListQuerySchema.parse({ page: 2 });

    expect(inventoryKeys.dealership(1)).toEqual(['inventory', 1]);
    expect(inventoryKeys.vehicles(1, query)).toEqual(['inventory', 1, 'vehicles', query]);
    expect(inventoryKeys.facets(1)).toEqual(['inventory', 1, 'facets']);
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
