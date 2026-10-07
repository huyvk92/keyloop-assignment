import type { ActionStatus } from '@shared/api/actions';
import type { SortKey, SortOrder } from '@shared/api/vehicles';
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

export type VehiclePageQuery = {
  dealershipId: number;
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
  makeModel: { asc: 'v.make ASC, v.model ASC', desc: 'v.make DESC, v.model DESC' },
};
const TIE_BREAK = 'v.stock_number ASC, v.id ASC';

const SELECT_LIST = `
  SELECT v.id, v.dealership_id AS dealershipId, v.vin, v.stock_number AS stockNumber, v.make,
         v.model, v.model_year AS modelYear, v.trim_level AS trim, v.colour, v.mileage,
         v.list_price_minor AS listPriceMinor, v.stock_in_date AS stockInDate,
         a.status AS actionStatus, a.logged_by AS actionLoggedBy, a.logged_at AS actionLoggedAt
  FROM vehicles v
  LEFT JOIN vehicle_actions a ON a.id = (
    SELECT id FROM vehicle_actions WHERE vehicle_id = v.id
    ORDER BY logged_at DESC, id DESC LIMIT 1
  )
  WHERE v.dealership_id = @dealershipId`;

type PageParams = { dealershipId: number; limit: number; offset: number };

/** SQL only: inventory reads, scoped by dealership. */
export function createInventoryRepository(db: Db) {
  const countStatement = db
    .prepare<[number], number>('SELECT COUNT(*) FROM vehicles WHERE dealership_id = ?')
    .pluck();
  // One prepared statement per whitelisted sort/order pair
  const pageStatements = new Map(
    Object.entries(ORDER_BY).flatMap(([sort, orders]) =>
      Object.entries(orders).map(([order, orderBy]) => [
        `${sort}:${order}`,
        db.prepare<[PageParams], VehicleRow>(
          `${SELECT_LIST} ORDER BY ${orderBy}, ${TIE_BREAK} LIMIT @limit OFFSET @offset`,
        ),
      ]),
    ),
  );

  return {
    listPage({ dealershipId, sort, order, limit, offset }: VehiclePageQuery) {
      const statement = pageStatements.get(`${sort}:${order}`);
      if (!statement) throw new Error(`Unsupported sort: ${sort} ${order}`);
      return {
        rows: statement.all({ dealershipId, limit, offset }),
        total: countStatement.get(dealershipId) ?? 0,
      };
    },
  };
}

export type InventoryRepository = ReturnType<typeof createInventoryRepository>;
