import {
  VehicleListQuerySchema,
  type InventorySummary,
  type VehicleListItem,
} from '@shared/api/vehicles';
import { queryVehicles } from '@/mocks/vehicle-query';

/**
 * In-memory equivalent of GET /api/dealerships/:dealershipId/summary (the server's
 * `inventory.service.ts` getSummary), kept honest by the shared SUMMARY_SCENARIOS table.
 * `vehicles` is one dealership's whole stock; `daysInStock` is already clamped at 0 (BR-01).
 */

/** The aging and needs-attention counts reuse the mock list filters, as the API reuses its own. */
const AGING_ONLY = VehicleListQuerySchema.parse({ agingOnly: 'true' });
const NEEDS_ATTENTION = VehicleListQuerySchema.parse({ needsAttention: 'true' });

export function summarizeVehicles(vehicles: VehicleListItem[], asOfDate: string): InventorySummary {
  const totalVehicles = vehicles.length;
  const agingCount = queryVehicles(vehicles, AGING_ONLY).length;
  const totalDays = vehicles.reduce((sum, vehicle) => sum + vehicle.daysInStock, 0);
  const empty = totalVehicles === 0;
  return {
    asOfDate,
    totalVehicles,
    agingCount,
    // TA-21: 1 dp and a whole day, half up; empty stock gives 0 % and null (BR-15). Multiply
    // before dividing, as the API does, so float error cannot break half up (201 / 400 = 50.3).
    agingPercent: empty ? 0 : Math.round((agingCount * 1000) / totalVehicles) / 10,
    averageDaysInStock: empty ? null : Math.round(totalDays / totalVehicles),
    needsAttentionCount: queryVehicles(vehicles, NEEDS_ATTENTION).length,
  };
}
