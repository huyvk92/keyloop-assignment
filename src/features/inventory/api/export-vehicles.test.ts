import { VehicleListQuerySchema, type VehicleListItem } from '@shared/api/vehicles';
import { delay, http, HttpResponse } from 'msw';
import { apiUrl } from '@/lib/http';
import { buildVehiclePage, buildVehicles } from '@/mocks/fixtures';
import { server } from '@/mocks/server';
import { fetchAllVehicles } from './export-vehicles';

const vehiclesUrl = apiUrl('/dealerships/:dealershipId/vehicles');

type Recorded = { params: URLSearchParams; dealershipId: string };

/** Serves `all` page by page and records each request's query. */
function serve(all: VehicleListItem[], { wait = 0 } = {}) {
  const requests: Recorded[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  server.use(
    http.get(vehiclesUrl, async ({ request, params }) => {
      const url = new URL(request.url);
      requests.push({ params: url.searchParams, dealershipId: String(params.dealershipId) });
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        if (wait) await delay(wait);
        return HttpResponse.json(
          buildVehiclePage(all, {
            page: Number(url.searchParams.get('page')),
            pageSize: Number(url.searchParams.get('pageSize')),
          }),
        );
      } finally {
        inFlight -= 1;
      }
    }),
  );
  return { requests, maxInFlight: () => maxInFlight };
}

const query = VehicleListQuerySchema.parse({
  make: 'Ford',
  ageBucket: 'over-90',
  q: 'stk',
  sort: 'price',
  order: 'desc',
  page: 3,
  pageSize: 25,
});

describe('fetchAllVehicles (T-043, ADR-010)', () => {
  it('fetches 230 vehicles in 3 requests of 100 with the current filters and sort, in order', async () => {
    const all = buildVehicles(230);
    const { requests } = serve(all);

    const vehicles = await fetchAllVehicles(1, query);

    expect(vehicles.map((v) => v.id)).toEqual(all.map((v) => v.id));
    expect(requests).toHaveLength(3);
    expect(requests.map((r) => r.params.get('page')).sort()).toEqual(['1', '2', '3']);
    for (const { params, dealershipId } of requests) {
      expect(dealershipId).toBe('1');
      expect(params.get('pageSize')).toBe('100');
      expect(params.get('make')).toBe('Ford');
      expect(params.get('ageBucket')).toBe('over-90');
      expect(params.get('q')).toBe('stk');
      expect(params.get('sort')).toBe('price');
      expect(params.get('order')).toBe('desc');
    }
    // Page 1 goes first: its total decides how many pages follow.
    expect(requests[0]?.params.get('page')).toBe('1');
  });

  it('keeps page order even when later pages answer first', async () => {
    const all = buildVehicles(300);
    server.use(
      http.get(vehiclesUrl, async ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page'));
        // Page 2 answers last.
        if (page === 2) await delay(30);
        return HttpResponse.json(buildVehiclePage(all, { page, pageSize: 100 }));
      }),
    );
    const vehicles = await fetchAllVehicles(1, query);
    expect(vehicles.map((v) => v.id)).toEqual(all.map((v) => v.id));
  });

  it('makes one request for an empty result', async () => {
    const { requests } = serve([]);
    await expect(fetchAllVehicles(1, query)).resolves.toEqual([]);
    expect(requests).toHaveLength(1);
  });

  it('fetches at most 4 pages at a time', async () => {
    const all = buildVehicles(1000);
    const served = serve(all, { wait: 10 });
    const vehicles = await fetchAllVehicles(1, query);
    expect(vehicles).toHaveLength(1000);
    expect(served.requests).toHaveLength(10);
    expect(served.maxInFlight()).toBeLessThanOrEqual(4);
    expect(served.maxInFlight()).toBeGreaterThan(1);
  });

  it('rejects the whole export when a later page fails (AC-013.2)', async () => {
    const all = buildVehicles(230);
    server.use(
      http.get(vehiclesUrl, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page'));
        if (page === 3)
          return HttpResponse.json({ error: { code: 'X', message: 'x' } }, { status: 500 });
        return HttpResponse.json(buildVehiclePage(all, { page, pageSize: 100 }));
      }),
    );
    await expect(fetchAllVehicles(1, query)).rejects.toMatchObject({
      name: 'HttpError',
      status: 500,
    });
  });

  it('rejects when a page does not match the contract', async () => {
    server.use(http.get(vehiclesUrl, () => HttpResponse.json({ items: 'nope' })));
    await expect(fetchAllVehicles(1, query)).rejects.toThrow();
  });

  it('is cancelled by its abort signal', async () => {
    server.use(http.get(vehiclesUrl, () => delay('infinite')));
    const controller = new AbortController();
    const result = fetchAllVehicles(1, query, { signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not start when the signal is already aborted', async () => {
    const { requests } = serve(buildVehicles(5));
    const controller = new AbortController();
    controller.abort();
    await expect(fetchAllVehicles(1, query, { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(requests).toHaveLength(0);
  });
});
