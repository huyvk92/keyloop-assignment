import {
  FacetsResponseSchema,
  VehicleListResponseSchema,
  type FacetsResponse,
  type VehicleListQuery,
  type VehicleListResponse,
} from '@shared/api/vehicles';
import { apiUrl, fetchJson } from '@/lib/http';

/** GET /api/dealerships/:dealershipId/vehicles - one page, filtered, sorted and derived on the server. */
export function getVehicles(
  dealershipId: number,
  query: VehicleListQuery,
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
