import type { VehicleListQuery } from '@shared/api/vehicles';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { getVehicles } from './inventory.api';

/** Every inventory key starts with `['inventory', dealershipId]` so one prefix refreshes all. */
export const inventoryKeys = {
  all: ['inventory'] as const,
  dealership: (dealershipId: number) => [...inventoryKeys.all, dealershipId] as const,
  vehicles: (dealershipId: number, query: VehicleListQuery) =>
    [...inventoryKeys.dealership(dealershipId), 'vehicles', query] as const,
};

/** Freshness: 60 s polling while visible, refetch on focus (ADR-007, TA-14). */
const POLL_INTERVAL_MS = 60_000;

export const vehicleListOptions = (dealershipId: number, query: VehicleListQuery) =>
  queryOptions({
    queryKey: inventoryKeys.vehicles(dealershipId, query),
    queryFn: ({ signal }) => getVehicles(dealershipId, query, signal),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    // Keep the current page visible while the next one loads (TRD section 6), but only within
    // the same dealership: another dealership's rows must never show under this one (BR-04).
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === dealershipId ? previous : undefined,
  });

export const useVehicleList = (dealershipId: number, query: VehicleListQuery) =>
  useQuery(vehicleListOptions(dealershipId, query));
