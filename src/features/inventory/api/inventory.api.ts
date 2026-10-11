import {
  FacetsResponseSchema,
  InventorySummarySchema,
  VehicleListResponseSchema,
  type FacetsResponse,
  type InventorySummary,
  type VehicleListQuery,
  type VehicleListResponse,
} from '@shared/api/vehicles';
import { apiUrl, fetchJson } from '@/lib/http';

/**
 * GET /api/dealerships/:dealershipId/vehicles - one page, filtered, sorted and derived on the
 * server. Only the given params are sent; the API applies its defaults to the rest.
 */
export function getVehicles(
  dealershipId: number,
  query: Partial<VehicleListQuery>,
  signal?: AbortSignal,
): Promise<VehicleListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return fetchJson(
    apiUrl(`/dealerships/${dealershipId}/vehicles?${params.toString()}`),
    VehicleListResponseSchema,
    { signal },
  );
}

/** GET /api/dealerships/:dealershipId/facets - makes A-Z, each with its models A-Z (BR-06). */
export function getFacets(dealershipId: number, signal?: AbortSignal): Promise<FacetsResponse> {
  return fetchJson(apiUrl(`/dealerships/${dealershipId}/facets`), FacetsResponseSchema, {
    signal,
  });
}

/**
 * GET /api/dealerships/:dealershipId/summary - KPIs over the whole in-stock inventory. No query
 * string is sent: list filters never apply to the summary (BR-15, AC-005.2).
 */
export function getSummary(dealershipId: number, signal?: AbortSignal): Promise<InventorySummary> {
  return fetchJson(apiUrl(`/dealerships/${dealershipId}/summary`), InventorySummarySchema, {
    signal,
  });
}
