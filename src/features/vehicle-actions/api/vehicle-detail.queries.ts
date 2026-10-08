import { queryOptions, useQuery } from '@tanstack/react-query';
import { POLLING } from '@/lib/polling';
import { getVehicleDetail } from './vehicle-detail.api';

/**
 * Vehicle detail keys (TRD section 5). Not under `['inventory', dealershipId]`: the detail is
 * addressed by vehicle id only, and the log-action mutation invalidates both prefixes.
 */
export const vehicleKeys = {
  all: ['vehicles'] as const,
  detail: (vehicleId: number) => [...vehicleKeys.all, 'detail', vehicleId] as const,
};

/**
 * One vehicle with its full history, newest first (AC-004.4, AC-007.4). Polled like the
 * dashboard (60 s while visible, and on focus; ADR-007), so another user's action shows while the
 * drawer is open (AC-009.3); the form never takes query values, so polling keeps typed input
 * (AC-009.1). No placeholder: the key varies by vehicle, and another vehicle's history must never
 * show under this one.
 */
export const vehicleDetailOptions = (vehicleId: number) =>
  queryOptions({
    queryKey: vehicleKeys.detail(vehicleId),
    queryFn: ({ signal }) => getVehicleDetail(vehicleId, signal),
    ...POLLING,
  });

export const useVehicleDetail = (vehicleId: number) => useQuery(vehicleDetailOptions(vehicleId));
