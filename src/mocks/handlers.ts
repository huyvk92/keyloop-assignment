import type { ApiError } from '@shared/api/common';
import { DealershipParamsSchema, type DealershipListResponse } from '@shared/api/dealerships';
import { VehicleListQuerySchema, type FacetsResponse } from '@shared/api/vehicles';
import { http, HttpResponse, type RequestHandler } from 'msw';
import { apiUrl } from '@/lib/http';
import {
  buildFacets,
  buildVehiclePage,
  fixtureDealerships,
  fixtureVehicles,
} from '@/mocks/fixtures';
import { queryVehicles } from '@/mocks/vehicle-query';

/**
 * Default API mocks shared by dev (VITE_USE_MOCKS), tests and Storybook.
 * Build URLs with apiUrl() from '@/lib/http'. Override per test with server.use(...).
 * Responses mirror the real API (server/src/modules), including its error bodies.
 */

function apiError(status: number, code: string, message: string) {
  return HttpResponse.json<ApiError>({ error: { code, message } }, { status });
}

const VEHICLE_QUERY_KEYS: ReadonlySet<string> = new Set(Object.keys(VehicleListQuerySchema.shape));

/**
 * The API rejects a repeated query key of the schema (`?make=A&make=B`) with 400 (TA-27); other
 * keys are stripped, so repeating them (`?utm=1&utm=2`) is ignored like any unknown key.
 */
function hasRepeatedQueryKey(params: URLSearchParams): boolean {
  const keys = [...params.keys()].filter((key) => VEHICLE_QUERY_KEYS.has(key));
  return new Set(keys).size !== keys.length;
}

const isKnownDealership = (id: number) => fixtureDealerships.some((d) => d.id === id);

export const handlers: RequestHandler[] = [
  http.get(apiUrl('/dealerships'), () =>
    HttpResponse.json<DealershipListResponse>({ items: fixtureDealerships }),
  ),

  http.get(apiUrl('/dealerships/:dealershipId/vehicles'), ({ params, request }) => {
    const parsedParams = DealershipParamsSchema.safeParse(params);
    const searchParams = new URL(request.url).searchParams;
    const query = VehicleListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsedParams.success || !query.success || hasRepeatedQueryKey(searchParams)) {
      return apiError(400, 'VALIDATION_ERROR', 'Request validation failed');
    }

    const { dealershipId } = parsedParams.data;
    if (!isKnownDealership(dealershipId)) {
      return apiError(404, 'NOT_FOUND', `Dealership ${dealershipId} not found`);
    }

    const stock = fixtureVehicles.filter((v) => v.dealershipId === dealershipId);
    return HttpResponse.json(buildVehiclePage(queryVehicles(stock, query.data), query.data));
  }),

  http.get(apiUrl('/dealerships/:dealershipId/facets'), ({ params }) => {
    const parsedParams = DealershipParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return apiError(400, 'VALIDATION_ERROR', 'Request validation failed');
    }
    const { dealershipId } = parsedParams.data;
    if (!isKnownDealership(dealershipId)) {
      return apiError(404, 'NOT_FOUND', `Dealership ${dealershipId} not found`);
    }
    const stock = fixtureVehicles.filter((v) => v.dealershipId === dealershipId);
    return HttpResponse.json(buildFacets(stock) satisfies FacetsResponse);
  }),
];
