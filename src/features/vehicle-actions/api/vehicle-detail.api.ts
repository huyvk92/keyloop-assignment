import { ActionEntrySchema, type ActionEntry, type CreateActionBody } from '@shared/api/actions';
import { VehicleDetailSchema, type VehicleDetail } from '@shared/api/vehicles';
import { apiUrl, fetchJson } from '@/lib/http';

/** GET /api/vehicles/:vehicleId - the vehicle, its dealership's currency/time zone and history. */
export function getVehicleDetail(vehicleId: number, signal?: AbortSignal): Promise<VehicleDetail> {
  return fetchJson(apiUrl(`/vehicles/${vehicleId}`), VehicleDetailSchema, { signal });
}

/**
 * POST /api/vehicles/:vehicleId/actions - appends a history entry (BR-13). The body is the
 * already parsed (trimmed) form value; the server assigns the timestamp. 400/404/422 throw an
 * `HttpError` whose `code` is mapped to a message by `lib/error-messages.ts`.
 */
export function logAction(vehicleId: number, body: CreateActionBody): Promise<ActionEntry> {
  return fetchJson(apiUrl(`/vehicles/${vehicleId}/actions`), ActionEntrySchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
