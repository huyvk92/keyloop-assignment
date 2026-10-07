import type { ApiError } from '@shared/api/common';
import { DealershipParamsSchema, type DealershipListResponse } from '@shared/api/dealerships';
import { VehicleListQuerySchema } from '@shared/api/vehicles';
import { http, HttpResponse, type RequestHandler } from 'msw';
import { apiUrl } from '@/lib/http';
import { buildVehiclePage, fixtureDealerships, fixtureVehicles } from '@/mocks/fixtures';

/**
 * Default API mocks shared by dev (VITE_USE_MOCKS), tests and Storybook.
 * Build URLs with apiUrl() from '@/lib/http'. Override per test with server.use(...).
 * Responses mirror the real API (server/src/modules), including its error bodies.
 */

function apiError(status: number, code: string, message: string) {
  return HttpResponse.json<ApiError>({ error: { code, message } }, { status });
}

export const handlers: RequestHandler[] = [
  http.get(apiUrl('/dealerships'), () =>
    HttpResponse.json<DealershipListResponse>({ items: fixtureDealerships }),
  ),

  http.get(apiUrl('/dealerships/:dealershipId/vehicles'), ({ params, request }) => {
    const parsedParams = DealershipParamsSchema.safeParse(params);
    const searchParams = new URL(request.url).searchParams;
    const query = VehicleListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsedParams.success || !query.success) {
      return apiError(400, 'VALIDATION_ERROR', 'Request validation failed');
    }

    const { dealershipId } = parsedParams.data;
    if (!fixtureDealerships.some((d) => d.id === dealershipId)) {
      return apiError(404, 'NOT_FOUND', `Dealership ${dealershipId} not found`);
    }

    const vehicles = fixtureVehicles.filter((v) => v.dealershipId === dealershipId);
    return HttpResponse.json(buildVehiclePage(vehicles, query.data));
  }),
];
