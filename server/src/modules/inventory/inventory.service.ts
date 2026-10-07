import type {
  SortKey,
  SortOrder,
  VehicleListItem,
  VehicleListQuery,
  VehicleListResponse,
} from '@shared/api/vehicles';
import type { Clock } from '../../lib/clock';
import { localDate } from '../../lib/dates';
import { NotFoundError } from '../../lib/errors';
import type { DealershipsRepository } from '../dealerships/dealerships.repository';
import type { InventoryRepository, VehicleRow } from './inventory.repository';
import { ageInDays, isAging } from './vehicle-age';

type Deps = {
  dealerships: DealershipsRepository;
  inventory: InventoryRepository;
  clock: Clock;
};

/** Order used when the query omits `order` (TA-06): oldest first, cheapest first, A-Z. */
const DEFAULT_ORDER: Record<SortKey, SortOrder> = { age: 'desc', price: 'asc', makeModel: 'asc' };

/** Derived fields are computed on every request, never stored (BR-01..BR-03, BR-14, BR-16). */
function toListItem(row: VehicleRow, today: string): VehicleListItem {
  const daysInStock = ageInDays(row.stockInDate, today);
  const aging = isAging(daysInStock);
  const currentAction =
    row.actionStatus && row.actionLoggedBy && row.actionLoggedAt
      ? { status: row.actionStatus, loggedBy: row.actionLoggedBy, loggedAt: row.actionLoggedAt }
      : null;
  return {
    id: row.id,
    dealershipId: row.dealershipId,
    vin: row.vin,
    stockNumber: row.stockNumber,
    make: row.make,
    model: row.model,
    modelYear: row.modelYear,
    trim: row.trim,
    colour: row.colour,
    mileage: row.mileage,
    listPriceMinor: row.listPriceMinor,
    stockInDate: row.stockInDate,
    daysInStock,
    isAging: aging,
    needsAttention: aging && currentAction === null,
    currentAction,
  };
}

export function createInventoryService({ dealerships, inventory, clock }: Deps) {
  return {
    listVehicles(dealershipId: number, query: VehicleListQuery): VehicleListResponse {
      const dealership = dealerships.findById(dealershipId);
      if (!dealership) throw new NotFoundError(`Dealership ${dealershipId} not found`);

      const today = localDate(clock.now(), dealership.timeZone);
      const { rows, total } = inventory.listPage({
        dealershipId,
        sort: query.sort,
        order: query.order ?? DEFAULT_ORDER[query.sort],
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      });
      return {
        items: rows.map((row) => toListItem(row, today)),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    },
  };
}

export type InventoryService = ReturnType<typeof createInventoryService>;
