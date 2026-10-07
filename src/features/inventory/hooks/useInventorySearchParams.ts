import type { FacetsResponse, SortKey, SortOrder, VehicleListQuery } from '@shared/api/vehicles';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { inventoryKeys } from '../api/inventory.queries';
import {
  FILTERS_CLEARED_STATE,
  hasActiveFilters,
  toSearchParams,
  type FilterKey,
  type VehicleFilters,
} from '../lib/search-params';
import { useParsedSearch } from './useParsedSearch';

type WriteOptions = { replace?: boolean; state?: unknown };

/** Does `make` (per the dealership's facets) offer `model`? Unknown facets count as "no". */
function makeHasModel(facets: FacetsResponse | undefined, make: string, model: string): boolean {
  return facets?.makes.find((facet) => facet.make === make)?.models.includes(model) ?? false;
}

const toSearch = (query: Partial<VehicleListQuery>) => {
  const params = toSearchParams(query).toString();
  return params ? `?${params}` : '';
};

/**
 * Dashboard URL state (ADR-008, TRD section 5): the typed list query read from the search
 * params, plus setters that write it back. The URL is the only source of truth, so reload,
 * Back and a shared link restore the same filters (AC-002.7).
 *
 * - Invalid, unknown or repeated params are ignored; `useCanonicalSearch` (called once by the
 *   page) replaces the URL (TA-09).
 * - Defaults stay out of the URL.
 * - Every filter or sort change returns to page 1 and pushes a history entry, except refining a
 *   search, which replaces it (TA-28).
 * - A make change clears a model the new make doesn't offer (BR-06, AC-002.2).
 */
export function useInventorySearchParams(dealershipId: number) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { query } = useParsedSearch();

  const write = useCallback(
    (next: Partial<VehicleListQuery>, { replace = false, state }: WriteOptions = {}) =>
      void navigate({ search: toSearch(next) }, { replace, state }),
    [navigate],
  );

  const setFilters = useCallback(
    (patch: VehicleFilters, options?: WriteOptions) => {
      const next: Partial<VehicleListQuery> = { ...query, ...patch, page: 1 };
      const makeChanged = 'make' in patch && patch.make !== query.make;
      if (makeChanged && !('model' in patch) && patch.make !== undefined && query.model) {
        const facets = queryClient.getQueryData<FacetsResponse>(inventoryKeys.facets(dealershipId));
        if (!makeHasModel(facets, patch.make, query.model)) next.model = undefined;
      }
      write(next, options);
    },
    [query, queryClient, dealershipId, write],
  );

  /**
   * Commits a (debounced) search. Starting a search pushes a history entry; refining one that is
   * already in the URL replaces it, so one Back leaves the search (TA-28). Clearing pushes.
   */
  const setSearch = useCallback(
    (q: string | undefined) =>
      setFilters({ q }, { replace: query.q !== undefined && q !== undefined }),
    [query.q, setFilters],
  );

  const setFilter = useCallback(
    <K extends FilterKey>(key: K, value: VehicleListQuery[K] | undefined) =>
      setFilters({ [key]: value }),
    [setFilters],
  );

  const setSort = useCallback(
    (sort: SortKey, order?: SortOrder) => write({ ...query, sort, order, page: 1 }),
    [query, write],
  );

  const setPage = useCallback(
    (page: number, options?: WriteOptions) => write({ ...query, page }, options),
    [query, write],
  );

  /**
   * Resets every filter (AC-002.8); the dealership (path), sort and page size stay. The location
   * state tells the filter bar to drop unapplied drafts too (`useFilterResetKey`).
   */
  const clearFilters = useCallback(
    () =>
      write(
        { sort: query.sort, order: query.order, pageSize: query.pageSize },
        { state: FILTERS_CLEARED_STATE },
      ),
    [query, write],
  );

  /** `?search` for another page with the same filters (for `<Navigate>`). */
  const searchFor = (page: number) => toSearch({ ...query, page });

  return {
    query,
    hasFilters: hasActiveFilters(query),
    setFilter,
    setFilters,
    setSearch,
    setSort,
    setPage,
    clearFilters,
    searchFor,
  };
}
