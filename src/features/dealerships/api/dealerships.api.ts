import { DealershipListResponseSchema, type DealershipListResponse } from '@shared/api/dealerships';
import { apiUrl, fetchJson } from '@/lib/http';

/** GET /api/dealerships (sorted A-Z by the API). */
export function getDealerships(signal?: AbortSignal): Promise<DealershipListResponse> {
  return fetchJson(apiUrl('/dealerships'), DealershipListResponseSchema, { signal });
}
