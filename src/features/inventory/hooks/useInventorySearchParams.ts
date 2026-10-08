import type { FacetsResponse, SortKey, SortOrder, VehicleListQuery } from '@shared/api/vehicles';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { inventoryKeys } from '../api/inventory.queries';
import {
  FILTERS_CLEARED_STATE,
  fromSearchParams,
  hasActiveFilters,
  toSearchParams,
  type FilterKey,
  type VehicleFilters,
} from '../lib/search-params';
import { useLatestSearch } from './useLatestSearch';
import { useParsedSearch } from './useParsedSearch';

type WriteOptions = {
  replace?: boolean;
  state?: unknown;
  /**
   * Render the new URL synchronously (React Router's `flushSync`). For changes from controlled
   * controls (selects, checkboxes, paging): without it the router re-renders in a transition, and
   * meanwhile React resets the control to the old value, so a select briefly flips back.
   */
  flushSync?: boolean;
};

/** Default for changes made in event handlers on controlled controls (see `flushSync`). */
const FROM_CONTROL = { flushSync: true } as const satisfies WriteOptions;

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
 * - Every setter builds on the router's latest URL at call time (`useLatestSearch`), not on the
 *   rendered `query`: a second change made before React re-renders keeps the first (Phase 6 bug).
 */
export function useInventorySearchParams(dealershipId: number) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { query } = useParsedSearch();
  const latestSearch = useLatestSearch();

  /** The query in the URL right now, including writes React hasn't rendered yet. */
  const latestQuery = useCallback(
    () => fromSearchParams(new URLSearchParams(latestSearch())).query,
    [latestSearch],
  );

  const write = useCallback(
    (
      next: Partial<VehicleListQuery>,
      { replace = false, state, flushSync = false }: WriteOptions = {},
    ) => void navigate({ search: toSearch(next) }, { replace, state, flushSync }),
    [navigate],
  );

  const setFilters = useCallback(
    (patch: VehicleFilters, options: WriteOptions = FROM_CONTROL) => {
      const current = latestQuery();
      const next: Partial<VehicleListQuery> = { ...current, ...patch, page: 1 };
      const makeChanged = 'make' in patch && patch.make !== current.make;
      if (makeChanged && !('model' in patch) && patch.make !== undefined && current.model) {
        const facets = queryClient.getQueryData<FacetsResponse>(inventoryKeys.facets(dealershipId));
        if (!makeHasModel(facets, patch.make, current.model)) next.model = undefined;
      }
      write(next, options);
    },
    [latestQuery, queryClient, dealershipId, write],
  );

  /**
   * Commits a (debounced) search. Starting a search pushes a history entry; refining one that is
   * already in the URL replaces it, so one Back leaves the search (TA-28). Clearing pushes.
   * Not `flushSync`: the search box shows its own draft, so nothing flickers.
   */
  const setSearch = useCallback(
    (q: string | undefined) =>
      setFilters({ q }, { replace: latestQuery().q !== undefined && q !== undefined }),
    [latestQuery, setFilters],
  );

  const setFilter = useCallback(
    <K extends FilterKey>(key: K, value: VehicleListQuery[K] | undefined) =>
      setFilters({ [key]: value }),
    [setFilters],
  );

  const setSort = useCallback(
    (sort: SortKey, order?: SortOrder) =>
      write({ ...latestQuery(), sort, order, page: 1 }, FROM_CONTROL),
    [latestQuery, write],
  );

  const setPage = useCallback(
    (page: number, options: WriteOptions = FROM_CONTROL) =>
      write({ ...latestQuery(), page }, options),
    [latestQuery, write],
  );

  /**
   * Resets every filter (AC-002.8); the dealership (path), sort and page size stay. The location
   * state tells the filter bar to drop unapplied drafts too (`useFilterResetKey`).
   */
  const clearFilters = useCallback(() => {
    const { sort, order, pageSize } = latestQuery();
    write({ sort, order, pageSize }, { state: FILTERS_CLEARED_STATE, flushSync: true });
  }, [latestQuery, write]);

  /**
   * Replaces every filter with exactly `filters` (TA-29): sort and page return to their
   * defaults, the page size stays, and a history entry is pushed. Like Clear filters, unapplied
   * drafts (search, age range) are dropped, so a pending search can't re-add itself afterwards.
   */
  const replaceFilters = useCallback(
    (filters: VehicleFilters) =>
      write(
        { ...filters, pageSize: latestQuery().pageSize },
        { state: FILTERS_CLEARED_STATE, flushSync: true },
      ),
    [latestQuery, write],
  );

  /** `?search` for another page with the same filters (for `<Navigate>`). */
  const searchFor = (page: number) => toSearch({ ...query, page });

  return {
    query,
    latestQuery,
    hasFilters: hasActiveFilters(query),
    setFilter,
    setFilters,
    replaceFilters,
    setSearch,
    setSort,
    setPage,
    clearFilters,
    searchFor,
  };
}
