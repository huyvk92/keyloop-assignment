import type { ApiError } from '@shared/api/common';
import { DealershipParamsSchema, type DealershipListResponse } from '@shared/api/dealerships';
import {
  VehicleListQuerySchema,
  VehicleParamsSchema,
  type FacetsResponse,
} from '@shared/api/vehicles';
import { http, HttpResponse, type RequestHandler } from 'msw';
import { apiUrl } from '@/lib/http';
import { mockActionStore, type MockActionOutcome } from '@/mocks/action-store';
import {
  buildFacets,
  buildSummary,
  buildVehiclePage,
  FIXTURE_TODAY,
  fixtureDealerships,
} from '@/mocks/fixtures';
import { summarizeVehicles } from '@/mocks/summary-query';
import { queryVehicles } from '@/mocks/vehicle-query';

/**
 * Default API mocks shared by dev (VITE_USE_MOCKS), tests and Storybook.
 * Build URLs with apiUrl() from '@/lib/http'. Override per test with server.use(...).
 * Responses mirror the real API (server/src/modules), including its error bodies.
 */

function apiError(status: number, code: string, message: string, details?: unknown) {
  return HttpResponse.json<ApiError>(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status },
  );
}

/** Like the API's 400: the issues of the part that failed (params before query) as `details`. */
function validationError(...results: { error?: { issues: unknown[] } | undefined }[]) {
  const failed = results.find((result) => result.error);
  return apiError(
    400,
    'VALIDATION_ERROR',
    'Request validation failed',
    failed?.error?.issues ?? [{ message: 'Repeated query parameter' }],
  );
}

type ParsedBody = { ok: true; body: unknown } | { ok: false; message: string };

/**
 * Reads a request body the way Fastify's default content-type parsers do on the API: JSON for
 * `application/json` (empty or malformed is an error), a plain string for `text/plain` (which then
 * fails the schema), no body when nothing is sent, and an error for any other media type. The
 * API answers every such error with 400 VALIDATION_ERROR (server/src/plugins/error-handler.ts).
 */
async function readBody(request: Request): Promise<ParsedBody> {
  const text = await request.text();
  const mediaType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (!mediaType) {
    return text === ''
      ? { ok: true, body: undefined }
      : { ok: false, message: 'Unsupported Media Type' };
  }
  if (mediaType === 'text/plain') return { ok: true, body: text };
  if (mediaType !== 'application/json') return { ok: false, message: 'Unsupported Media Type' };
  if (text === '') {
    return {
      ok: false,
      message: "Body cannot be empty when content-type is set to 'application/json'",
    };
  }
  try {
    const body: unknown = JSON.parse(text);
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      message: "Body is not valid JSON but content-type is set to 'application/json'",
    };
  }
}

/**
 * POST /api/vehicles/:vehicleId/actions backed by `store`. The default handlers use the shared
 * mock store; the parity table (src/mocks/action-store.test.ts) installs one per scenario.
 * Append-only (BR-13): like the API there is no PUT, PATCH or DELETE.
 */
export function logActionHandler(store: {
  log: (rawVehicleId: unknown, rawBody: unknown) => MockActionOutcome;
}) {
  return http.post(apiUrl('/vehicles/:vehicleId/actions'), async ({ params, request }) => {
    const parsed = await readBody(request);
    if (!parsed.ok) {
      return apiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
        { message: parsed.message },
      ]);
    }
    const outcome = store.log(params.vehicleId, parsed.body);
    return HttpResponse.json(outcome.body, { status: outcome.status });
  });
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

/** One dealership's stock, including current actions logged in this session (BR-14, BR-16). */
const stockOf = (dealershipId: number) =>
  mockActionStore.vehicles().filter((v) => v.dealershipId === dealershipId);

export const handlers: RequestHandler[] = [
  http.get(apiUrl('/dealerships'), () =>
    HttpResponse.json<DealershipListResponse>({ items: fixtureDealerships }),
  ),

  http.get(apiUrl('/dealerships/:dealershipId/vehicles'), ({ params, request }) => {
    const parsedParams = DealershipParamsSchema.safeParse(params);
    const searchParams = new URL(request.url).searchParams;
    const query = VehicleListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsedParams.success || !query.success || hasRepeatedQueryKey(searchParams)) {
      return validationError(parsedParams, query);
    }

    const { dealershipId } = parsedParams.data;
    if (!isKnownDealership(dealershipId)) {
      return apiError(404, 'NOT_FOUND', `Dealership ${dealershipId} not found`);
    }

    const stock = stockOf(dealershipId);
    return HttpResponse.json(buildVehiclePage(queryVehicles(stock, query.data), query.data));
  }),

  http.get(apiUrl('/dealerships/:dealershipId/facets'), ({ params }) => {
    const parsedParams = DealershipParamsSchema.safeParse(params);
    if (!parsedParams.success) return validationError(parsedParams);
    const { dealershipId } = parsedParams.data;
    if (!isKnownDealership(dealershipId)) {
      return apiError(404, 'NOT_FOUND', `Dealership ${dealershipId} not found`);
    }
    const stock = stockOf(dealershipId);
    return HttpResponse.json(buildFacets(stock) satisfies FacetsResponse);
  }),

  // Whole stock; like the API, any query string is ignored (BR-15, AC-005.2).
  http.get(apiUrl('/dealerships/:dealershipId/summary'), ({ params }) => {
    const parsedParams = DealershipParamsSchema.safeParse(params);
    if (!parsedParams.success) return validationError(parsedParams);
    const { dealershipId } = parsedParams.data;
    if (!isKnownDealership(dealershipId)) {
      return apiError(404, 'NOT_FOUND', `Dealership ${dealershipId} not found`);
    }
    const stock = stockOf(dealershipId);
    return HttpResponse.json(buildSummary(summarizeVehicles(stock, FIXTURE_TODAY)));
  }),

  http.get(apiUrl('/vehicles/:vehicleId'), ({ params }) => {
    const parsedParams = VehicleParamsSchema.safeParse(params);
    if (!parsedParams.success) return validationError(parsedParams);
    const { vehicleId } = parsedParams.data;
    const detail = mockActionStore.detail(vehicleId);
    if (!detail) return apiError(404, 'NOT_FOUND', `Vehicle ${vehicleId} not found`);
    return HttpResponse.json(detail);
  }),

  logActionHandler(mockActionStore),
];
