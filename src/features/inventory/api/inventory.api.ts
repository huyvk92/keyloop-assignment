import {
  VehicleListResponseSchema,
  type VehicleListQuery,
  type VehicleListResponse,
} from '@shared/api/vehicles';
import { apiUrl, fetchJson } from '@/lib/http';

/** GET /api/dealerships/:dealershipId/vehicles - one page, sorted and derived on the server. */
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
