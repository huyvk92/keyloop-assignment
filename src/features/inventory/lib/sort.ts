import type { SortKey, SortOrder } from '@shared/api/vehicles';

/** A sort as the user sees it: the key and its effective order (never "default"). */
export type SortState = { sort: SortKey; order: SortOrder };

/**
 * The order each key uses when none is given (TA-06, the server's rule): oldest first for age
 * (BR-17), lowest price first, and make/model A-Z (AC-011.2).
 */
export const DEFAULT_SORT_ORDER = {
  age: 'desc',
  price: 'asc',
  makeModel: 'asc',
} as const satisfies Record<SortKey, SortOrder>;

/** The order the list is actually sorted in, so headers can show it even when the URL omits it. */
export function effectiveOrder(sort: SortKey, order: SortOrder | undefined): SortOrder {
  return order ?? DEFAULT_SORT_ORDER[sort];
}

/**
 * The sort after activating `key`'s header: another key starts with its default order, the
 * active key toggles (AC-011.1).
 */
export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.sort !== key) return { sort: key, order: DEFAULT_SORT_ORDER[key] };
  return { sort: key, order: current.order === 'asc' ? 'desc' : 'asc' };
}

/**
 * The `order` to write to the URL: left out when it is the key's default (TA-06), like the other
 * defaults (TA-09), so each sort has one URL and one cache key (`sort=price`, not
 * `sort=price&order=asc`); `toSearchParams` applies the same rule to URLs it reads.
 */
export function urlOrder({ sort, order }: SortState): SortOrder | undefined {
  return order === DEFAULT_SORT_ORDER[sort] ? undefined : order;
}
