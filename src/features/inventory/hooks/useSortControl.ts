import type { SortKey, VehicleListQuery } from '@shared/api/vehicles';
import { useState } from 'react';
import { FILTER_KEYS } from '../lib/search-params';
import { effectiveOrder, nextSort, urlOrder, type SortState } from '../lib/sort';
import { useInventorySearchParams } from './useInventorySearchParams';

/** The filters a sort was chosen with, so its announcement belongs to that one result. */
const filtersOf = (query: VehicleListQuery) =>
  JSON.stringify(FILTER_KEYS.map((key) => query[key] ?? null));

/**
 * The sort the user chose, with the dealership and filters it was chosen for, and whether the URL
 * has shown it yet.
 */
type Requested = { sort: SortState; dealershipId: number; filters: string; shown: boolean };

/**
 * Sort state of the list (US-011): the current key and its effective order (TA-06), and `sortBy`
 * for the column headers. `sortBy` writes the URL through `useInventorySearchParams` (page 1,
 * history push, so reload and Back restore it, AC-011.3).
 *
 * `announced` is the sort the user just chose while the URL shows it, and `null` otherwise. The
 * request is one-shot: it is set only by `sortBy`, marked `shown` when the URL first matches it,
 * and dropped as soon as a shown request stops matching (Back, a filter change, another
 * dealership). So a reload, Back then Forward, a filter round trip or a dealership round trip
 * never announces a sort again; only a new click does. Before it is shown, the request is dropped
 * only for another dealership or other filters: neither changes between the click and the URL
 * update, so a fresh request can't be lost while its navigation is pending.
 */
export function useSortControl(dealershipId: number) {
  const { query, setSort } = useInventorySearchParams(dealershipId);
  const [requested, setRequested] = useState<Requested | null>(null);
  const current: SortState = { sort: query.sort, order: effectiveOrder(query.sort, query.order) };
  const filters = filtersOf(query);

  const sameResult =
    requested !== null && requested.dealershipId === dealershipId && requested.filters === filters;
  const matches =
    sameResult && requested.sort.sort === current.sort && requested.sort.order === current.order;
  // Adjust state while rendering (React docs pattern): React re-renders before committing.
  if (requested && matches && !requested.shown) setRequested({ ...requested, shown: true });
  if (requested && !matches && (requested.shown || !sameResult)) setRequested(null);

  const sortBy = (key: SortKey) => {
    const next = nextSort(current, key);
    setSort(next.sort, urlOrder(next));
    setRequested({ sort: next, dealershipId, filters, shown: false });
  };

  return { ...current, sortBy, announced: matches ? requested.sort : null };
}
