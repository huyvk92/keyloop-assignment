import type { VehicleListQuery } from '@shared/api/vehicles';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { getFacets, getSummary, getVehicles } from './inventory.api';

/** Every inventory key starts with `['inventory', dealershipId]` so one prefix refreshes all. */
export const inventoryKeys = {
  all: ['inventory'] as const,
  dealership: (dealershipId: number) => [...inventoryKeys.all, dealershipId] as const,
  vehicles: (dealershipId: number, query: VehicleListQuery) =>
    [...inventoryKeys.dealership(dealershipId), 'vehicles', query] as const,
  facets: (dealershipId: number) => [...inventoryKeys.dealership(dealershipId), 'facets'] as const,
  aging: (dealershipId: number) => [...inventoryKeys.dealership(dealershipId), 'aging'] as const,
  /** No filters in the key: the KPIs cover the whole stock (BR-15, AC-005.2). */
  summary: (dealershipId: number) =>
    [...inventoryKeys.dealership(dealershipId), 'summary'] as const,
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

/**
 * The aging section's request (TA-11): the 10 oldest vehicles over 90 days, whatever the list's
 * filters are (AC-004.1). Exactly these params are sent.
 */
export const AGING_STOCK_QUERY = {
  agingOnly: true,
  sort: 'age',
  order: 'desc',
  pageSize: 10,
} as const satisfies Partial<VehicleListQuery>;

/**
 * Same freshness as the list (60 s polling, refetch on focus). No placeholder: the key varies
 * only by dealership, and another dealership's rows must never show (BR-04).
 */
export const agingStockOptions = (dealershipId: number) =>
  queryOptions({
    queryKey: inventoryKeys.aging(dealershipId),
    queryFn: ({ signal }) => getVehicles(dealershipId, AGING_STOCK_QUERY, signal),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

export const useAgingStock = (dealershipId: number) => useQuery(agingStockOptions(dealershipId));

/**
 * KPI summary (US-005). Same freshness as the list (60 s polling, refetch on focus). The key has
 * no filters, so filtering the list never refetches it (AC-005.2), and there is no placeholder:
 * the key varies only by dealership, and another dealership's values must never show (BR-04).
 */
export const summaryOptions = (dealershipId: number) =>
  queryOptions({
    queryKey: inventoryKeys.summary(dealershipId),
    queryFn: ({ signal }) => getSummary(dealershipId, signal),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

export const useInventorySummary = (dealershipId: number) => useQuery(summaryOptions(dealershipId));

/** Makes and models change only when stock changes: 5 min stale time, no polling (TRD section 5). */
export const facetsOptions = (dealershipId: number) =>
  queryOptions({
    queryKey: inventoryKeys.facets(dealershipId),
    queryFn: ({ signal }) => getFacets(dealershipId, signal),
    staleTime: 5 * 60_000,
  });

export const useFacets = (dealershipId: number) => useQuery(facetsOptions(dealershipId));
