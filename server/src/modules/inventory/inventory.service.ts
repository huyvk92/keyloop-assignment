import type {
  FacetsResponse,
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
import type { InventoryRepository, MakeModelRow, VehicleRow } from './inventory.repository';
import { ageFilterToDateRange, ageInDays, isAging } from './vehicle-age';

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

/** Groups make/model rows (sorted by make, then model) into facets; equal makes are adjacent (BR-06). */
function toFacets(rows: MakeModelRow[]): FacetsResponse {
  const makes: FacetsResponse['makes'] = [];
  for (const { make, model } of rows) {
    const last = makes.at(-1);
    if (last?.make === make) last.models.push(model);
    else makes.push({ make, models: [model] });
  }
  return { makes };
}

export function createInventoryService({ dealerships, inventory, clock }: Deps) {
  function requireDealership(dealershipId: number) {
    const dealership = dealerships.findById(dealershipId);
    if (!dealership) throw new NotFoundError(`Dealership ${dealershipId} not found`);
    return dealership;
  }

  return {
    /** Make/model filter options from the dealership's own stock (BR-04, BR-06). */
    getFacets(dealershipId: number): FacetsResponse {
      requireDealership(dealershipId);
      return toFacets(inventory.listMakeModels(dealershipId));
    },

    listVehicles(dealershipId: number, query: VehicleListQuery): VehicleListResponse {
      const dealership = requireDealership(dealershipId);
      const today = localDate(clock.now(), dealership.timeZone);
      // "Needs attention" = aging AND no action (BR-16); false flags apply no restriction (BR-05)
      const needsAttention = query.needsAttention === true;
      const stockIn = ageFilterToDateRange(
        {
          ageBucket: query.ageBucket,
          minAge: query.minAge,
          maxAge: query.maxAge,
          agingOnly: query.agingOnly === true || needsAttention,
        },
        today,
      );
      // An empty age intersection is a valid filter with no matches, not an error (TA-07)
      if (stockIn === null) {
        return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
      }

      const { rows, total } = inventory.listPage({
        dealershipId,
        filter: {
          make: query.make,
          model: query.model,
          stockInFrom: stockIn.from,
          stockInTo: stockIn.to,
          search: query.q,
          withoutAction: needsAttention,
        },
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
