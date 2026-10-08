import type { ActionStatus } from '@shared/api/actions';
import type { SortKey, SortOrder } from '@shared/api/vehicles';
import type { Statement } from 'better-sqlite3';
import type { Db } from '../../db/connection';

/** A vehicle row joined with its latest action (null columns = no action). */
export type VehicleRow = {
  id: number;
  dealershipId: number;
  vin: string;
  stockNumber: string;
  make: string;
  model: string;
  modelYear: number;
  trim: string;
  colour: string;
  mileage: number;
  listPriceMinor: number;
  stockInDate: string;
  actionStatus: ActionStatus | null;
  actionLoggedBy: string | null;
  actionLoggedAt: string | null;
};

/**
 * Optional, ANDed list filters (BR-05). Age filters arrive as inclusive `stock_in_date` bounds
 * computed by the service, so SQL never reads "now" (ADR-002). `search` is the raw, trimmed text;
 * LIKE escaping is done here because it is an SQL concern.
 */
export type VehicleFilterCriteria = {
  make?: string | undefined;
  model?: string | undefined;
  stockInFrom?: string | undefined;
  stockInTo?: string | undefined;
  search?: string | undefined;
  /** Only vehicles with no action history (for "needs attention", BR-16). */
  withoutAction?: boolean | undefined;
};

export type VehiclePageQuery = {
  dealershipId: number;
  filter: VehicleFilterCriteria;
  sort: SortKey;
  order: SortOrder;
  limit: number;
  offset: number;
};

/**
 * ORDER BY whitelist (never interpolate input). Age desc = oldest first = stock_in_date ASC.
 * Every order ends with stock_number ASC, id ASC for a stable total order (BR-17, TA-06).
 */
const ORDER_BY: Record<SortKey, Record<SortOrder, string>> = {
  age: { desc: 'v.stock_in_date ASC', asc: 'v.stock_in_date DESC' },
  price: { asc: 'v.list_price_minor ASC', desc: 'v.list_price_minor DESC' },
  // NOCASE so "Hyundai i10" sorts before "Hyundai Tucson" (alphabetical, AC-011.2)
  makeModel: {
    asc: 'v.make COLLATE NOCASE ASC, v.model COLLATE NOCASE ASC',
    desc: 'v.make COLLATE NOCASE DESC, v.model COLLATE NOCASE DESC',
  },
};
const TIE_BREAK = 'v.stock_number ASC, v.id ASC';

/**
 * WHERE fragments: fixed SQL text with named parameters only. The query is assembled from the
 * fragments whose filter is present (in this fixed order), so input never reaches the SQL text.
 */
const FILTER_SQL = {
  make: 'v.make = @make',
  model: 'v.model = @model',
  stockInFrom: 'v.stock_in_date >= @stockInFrom',
  stockInTo: 'v.stock_in_date <= @stockInTo',
  // ASCII LIKE is case-insensitive in SQLite (BR-08, TA-08)
  search: `(v.vin LIKE @search ESCAPE '\\' OR v.stock_number LIKE @search ESCAPE '\\'
            OR v.model LIKE @search ESCAPE '\\')`,
  withoutAction: 'NOT EXISTS (SELECT 1 FROM vehicle_actions x WHERE x.vehicle_id = v.id)',
} as const satisfies Record<keyof VehicleFilterCriteria, string>;
type FilterKey = keyof typeof FILTER_SQL;
const FILTER_KEYS = Object.keys(FILTER_SQL) as FilterKey[];

/** `%`, `_` and the escape character itself match literally (BR-08). */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

const SELECT_LIST = `
  SELECT v.id, v.dealership_id AS dealershipId, v.vin, v.stock_number AS stockNumber, v.make,
         v.model, v.model_year AS modelYear, v.trim_level AS trim, v.colour, v.mileage,
         v.list_price_minor AS listPriceMinor, v.stock_in_date AS stockInDate,
         a.status AS actionStatus, a.logged_by AS actionLoggedBy, a.logged_at AS actionLoggedAt
  FROM vehicles v
  LEFT JOIN vehicle_actions a ON a.id = (
    SELECT id FROM vehicle_actions WHERE vehicle_id = v.id
    ORDER BY logged_at DESC, id DESC LIMIT 1
  )`;
const SELECT_COUNT = 'SELECT COUNT(*) FROM vehicles v';

export type MakeModelRow = { make: string; model: string };

/** Whole-stock aggregates for the KPI summary; percent and average are derived in the service. */
export type SummaryTotals = {
  totalVehicles: number;
  agingCount: number;
  /** Sum of ages in days, each clamped at 0 (BR-01, TA-22). */
  totalDaysInStock: number;
  needsAttentionCount: number;
};

export type SummaryQuery = {
  dealershipId: number;
  /** Dealership-local "today" (YYYY-MM-DD) computed by the service (ADR-002). */
  today: string;
  /** Latest aging stock-in date (`stock_in_date <= agingCutoff` = aging, BR-02). */
  agingCutoff: string;
};

/**
 * One statement for every KPI (TRD §4.3). The aging and needs-attention predicates are the list's
 * own filter fragments (`stockInTo` bound to the aging cutoff, `withoutAction`), so the counts
 * always equal the `agingOnly=true` / `needsAttention=true` list totals (BR-16). `julianday` on
 * date-only strings is DST-free; the CAST keeps the sum an exact integer.
 */
const SUMMARY_SQL = `
  SELECT COUNT(*) AS totalVehicles,
         COALESCE(SUM(${FILTER_SQL.stockInTo}), 0) AS agingCount,
         COALESCE(SUM(CAST(max(0, julianday(@today) - julianday(v.stock_in_date)) AS INTEGER)), 0)
           AS totalDaysInStock,
         COALESCE(SUM(${FILTER_SQL.stockInTo} AND ${FILTER_SQL.withoutAction}), 0)
           AS needsAttentionCount
  FROM vehicles v
  WHERE v.dealership_id = @dealershipId`;

type SqlParams = Record<string, string | number>;

/** Active filter keys and their named parameters. */
function bindFilter(dealershipId: number, filter: VehicleFilterCriteria) {
  const keys: FilterKey[] = [];
  const params: SqlParams = { dealershipId };
  for (const key of FILTER_KEYS) {
    const value = filter[key];
    if (value === undefined || value === false) continue;
    keys.push(key);
    if (key === 'search') params.search = `%${escapeLike(String(value))}%`;
    else if (key !== 'withoutAction') params[key] = String(value);
  }
  const where = ['v.dealership_id = @dealershipId', ...keys.map((key) => FILTER_SQL[key])];
  return { keys, params, where: `WHERE ${where.join(' AND ')}` };
}

/** SQL only: inventory reads, scoped by dealership (BR-04). */
export function createInventoryRepository(db: Db) {
  // Statements are prepared once per (filter combination, sort) and reused; the cache is bounded
  // by 2^6 filter combinations x 6 orders.
  const cache = new Map<string, Statement>();
  function statement(key: string, sql: () => string, pluck = false): Statement {
    let prepared = cache.get(key);
    if (!prepared) {
      prepared = db.prepare(sql()).pluck(pluck);
      cache.set(key, prepared);
    }
    return prepared;
  }

  const makeModelStatement = db.prepare<[number], MakeModelRow>(
    `SELECT DISTINCT make, model FROM vehicles WHERE dealership_id = ?
     ORDER BY make COLLATE NOCASE, make, model COLLATE NOCASE, model`,
  );

  const summaryStatement = db.prepare<
    [{ dealershipId: number; today: string; stockInTo: string }],
    SummaryTotals
  >(SUMMARY_SQL);

  return {
    /** KPI aggregates over the dealership's whole stock; no list filters apply (BR-15). */
    summaryTotals({ dealershipId, today, agingCutoff }: SummaryQuery): SummaryTotals {
      // COUNT/SUM without GROUP BY always yields exactly one row.
      return summaryStatement.get({ dealershipId, today, stockInTo: agingCutoff })!;
    },

    /** Distinct make/model pairs in the dealership's stock, make then model A-Z ignoring case (BR-06). */
    listMakeModels(dealershipId: number): MakeModelRow[] {
      return makeModelStatement.all(dealershipId);
    },

    listPage({ dealershipId, filter, sort, order, limit, offset }: VehiclePageQuery) {
      const orderBy = ORDER_BY[sort]?.[order];
      if (!orderBy) throw new Error(`Unsupported sort: ${sort} ${order}`);
      const { keys, params, where } = bindFilter(dealershipId, filter);
      const filterKey = keys.join(',');

      const page = statement(
        `page|${filterKey}|${sort}:${order}`,
        () =>
          `${SELECT_LIST} ${where} ORDER BY ${orderBy}, ${TIE_BREAK} LIMIT @limit OFFSET @offset`,
      );
      const count = statement(`count|${filterKey}`, () => `${SELECT_COUNT} ${where}`, true);
      return {
        rows: page.all({ ...params, limit, offset }) as VehicleRow[],
        total: (count.get(params) as number | undefined) ?? 0,
      };
    },
  };
}

export type InventoryRepository = ReturnType<typeof createInventoryRepository>;
