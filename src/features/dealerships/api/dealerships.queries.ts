import type { Dealership } from '@shared/api/dealerships';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { getDealerships } from './dealerships.api';

export const dealershipKeys = {
  all: ['dealerships'] as const,
  list: () => [...dealershipKeys.all, 'list'] as const,
};

/** Dealerships rarely change: 5 min stale time, no polling (TRD section 5). */
export const dealershipListOptions = () =>
  queryOptions({
    queryKey: dealershipKeys.list(),
    queryFn: ({ signal }) => getDealerships(signal),
    staleTime: 5 * 60_000,
  });

export const useDealerships = () => useQuery(dealershipListOptions());

/**
 * One dealership from the cached list. `data` is `undefined` once loaded when the id is unknown
 * (or missing because the URL param was invalid): the caller renders "Dealership not found".
 */
export const useDealership = (dealershipId: number | undefined) =>
  useQuery({
    ...dealershipListOptions(),
    select: (data): Dealership | undefined => data.items.find((d) => d.id === dealershipId),
  });
