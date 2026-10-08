import { isBlankText, type ActionEntry, type CreateActionBody } from '@shared/api/actions';
import { AGING_THRESHOLD_DAYS } from '@shared/api/vehicles';
import type { Clock } from '../../lib/clock';
import { BusinessRuleError } from '../../lib/errors';
import type { InventoryService } from '../inventory/inventory.service';
import type { ActionsRepository } from './actions.repository';

type Deps = {
  /** Source of the vehicle's derived fields, so "aging" means exactly what the list shows. */
  vehicles: Pick<InventoryService, 'getVehicle'>;
  actions: ActionsRepository;
  clock: Clock;
};

export function createActionsService({ vehicles, actions, clock }: Deps) {
  return {
    /**
     * Appends an action (BR-13). The body is already schema-validated (BR-10..BR-12, 400); this
     * adds the 404 and the aging rule (BR-09, 422) and assigns the timestamp from the clock
     * (TA-12, TA-13). The check and the insert run synchronously with no await in between, so no
     * other request can interleave.
     */
    logAction(vehicleId: number, body: CreateActionBody): ActionEntry {
      const vehicle = vehicles.getVehicle(vehicleId);
      if (!vehicle.isAging) {
        throw new BusinessRuleError(
          'VEHICLE_NOT_AGING',
          `Actions can only be logged for vehicles in stock for more than ${AGING_THRESHOLD_DAYS} days`,
          { daysInStock: vehicle.daysInStock },
        );
      }
      // Trimmed again so the rules hold for any caller, not only the HTTP schema (BR-18).
      const note = body.note === undefined || isBlankText(body.note) ? null : body.note.trim(); // TA-17
      return actions.insert({
        vehicleId,
        status: body.status,
        note,
        loggedBy: body.loggedBy.trim(),
        loggedAt: clock.now().toISOString(),
      });
    },
  };
}

export type ActionsService = ReturnType<typeof createActionsService>;
