import {
  PAGE_SIZE_DEFAULT,
  VehicleListQuerySchema,
  type VehicleListQuery,
} from '@shared/api/vehicles';
import { z } from 'zod';

/**
 * Dashboard URL state (ADR-008): filters, sort and page live in the search params, the
 * dealership in the path. The shared `VehicleListQuerySchema` is the single source of truth
 * for what is valid, so the URL accepts exactly what the API accepts.
 */

type QueryKey = keyof VehicleListQuery;

/** Params the dashboard understands, in the order they are written to the URL. */
const URL_KEYS = [
  'make',
  'model',
  'ageBucket',
  'minAge',
  'maxAge',
  'agingOnly',
  'needsAttention',
  'q',
  'sort',
  'order',
  'page',
  'pageSize',
] as const satisfies readonly QueryKey[];

/** The filter part of the query (BR-05); sort, order and paging are not filters. */
export const FILTER_KEYS = [
  'make',
  'model',
  'ageBucket',
  'minAge',
  'maxAge',
  'agingOnly',
  'needsAttention',
  'q',
] as const satisfies readonly QueryKey[];
export type FilterKey = (typeof FILTER_KEYS)[number];
export type VehicleFilters = Partial<Pick<VehicleListQuery, FilterKey>>;

/** Values that mean "no restriction" or the contract default stay out of the URL (TA-09). */
const DEFAULTS: Partial<Record<QueryKey, string>> = {
  sort: 'age',
  page: '1',
  pageSize: String(PAGE_SIZE_DEFAULT),
  agingOnly: 'false',
  needsAttention: 'false',
};

function isUrlKey(key: string): key is (typeof URL_KEYS)[number] {
  return (URL_KEYS as readonly string[]).includes(key);
}

/** Write a typed query as canonical search params: fixed order, no defaults (TA-09). */
export function toSearchParams(query: Partial<VehicleListQuery>): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of URL_KEYS) {
    const value = query[key];
    if (value === undefined) continue;
    const text = String(value);
    if (DEFAULTS[key] === text) continue;
    params.set(key, text);
  }
  return params;
}

type Parsed = {
  query: VehicleListQuery;
  /** Canonical search string (no `?`) for `query`; differs from the input when it was cleaned. */
  search: string;
};

/**
 * Read the URL into a typed query. Invalid values, unknown keys and repeated keys are dropped
 * rather than failing the page (TA-09); the caller replaces the URL with `search`.
 * A min > max age range is dropped as a whole, so half a range is never applied (AC-002.4).
 */
export function fromSearchParams(params: URLSearchParams): Parsed {
  const raw: Record<string, string> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    // Repeated keys are ambiguous and the API rejects them (TA-27).
    if (isUrlKey(key) && values.length === 1 && values[0] !== undefined) raw[key] = values[0];
  }

  // Each pass removes at least one offending key, so this ends within URL_KEYS.length + 1 passes.
  for (let pass = 0; pass <= URL_KEYS.length; pass += 1) {
    const result = VehicleListQuerySchema.safeParse(raw);
    if (result.success) {
      const canonical = toSearchParams(result.data);
      // Parse the canonical form so the query (and its cache key) is the same before and after
      // the URL is replaced, e.g. `agingOnly=false` and no `agingOnly` give one request, not two.
      const query = VehicleListQuerySchema.parse(Object.fromEntries(canonical));
      return { query, search: canonical.toString() };
    }
    for (const issue of result.error.issues) {
      const [key] = issue.path;
      // The only object-level rule is min <= max (reported on maxAge): drop the whole range.
      if (issue.code === 'custom') {
        delete raw.minAge;
        delete raw.maxAge;
      } else if (typeof key === 'string') {
        delete raw[key];
      }
    }
  }
  // Unreachable with the current schema; fall back to the defaults rather than throwing.
  const query = VehicleListQuerySchema.parse({});
  return { query, search: '' };
}

/** True when any filter restricts the list (sort and page don't count). */
export function hasActiveFilters(query: VehicleListQuery): boolean {
  return FILTER_KEYS.some((key) => {
    const value = query[key];
    return value !== undefined && value !== false;
  });
}

/**
 * DOM id of the filter region (one per page). "Clear filters" in the empty state removes its own
 * button, so it moves focus here instead of letting it fall to `<body>` (WCAG 2.4.3).
 */
export const FILTER_REGION_ID = 'inventory-filters';

/**
 * DOM id of the vehicle list region (one per page). "View all aging vehicles" moves focus here so
 * keyboard and screen reader users land on the results it filtered (TA-11).
 */
export const LIST_REGION_ID = 'inventory-list';

/**
 * Router location state of the navigation made by "Clear filters" (AC-002.8). Clearing can leave
 * the URL's range and search unchanged (e.g. from `?q=zzz` the range was never applied), so the
 * filter bar can't tell from the URL alone that unapplied drafts must be dropped; this marker
 * tells it.
 */
export const FILTERS_CLEARED_STATE = { filtersCleared: true } as const;

const FiltersClearedStateSchema = z.object({ filtersCleared: z.literal(true) });

/** History state is external data (it survives reloads), so it is validated, not trusted. */
export function isFiltersClearedState(state: unknown): boolean {
  return FiltersClearedStateSchema.safeParse(state).success;
}
