import { Dialog } from '@/components/Dialog';
import { VehicleDetailPanel } from './VehicleDetailPanel';
import { VehicleDetailTitle } from './VehicleDetailTitle';

type Props = {
  /** The open vehicle, or null when closed (local page state, TA-16). */
  vehicleId: number | null;
  onClose: () => void;
  /** Focus target on close when the opening control is gone (e.g. its row left the list). */
  returnFocusFallback?: () => HTMLElement | null;
};

/**
 * The vehicle drawer (ADR-006): facts, current action, "Log action" form and history. The body
 * is keyed by vehicle id, so each vehicle starts with a fresh form, and a refetch of the same
 * vehicle never remounts (resets) it (TRD risk "Polling or refetch resets the in-progress form").
 */
export function VehicleDetailDialog({ vehicleId, onClose, returnFocusFallback }: Props) {
  return (
    <Dialog
      open={vehicleId !== null}
      onClose={onClose}
      returnFocusFallback={returnFocusFallback}
      title={vehicleId !== null && <VehicleDetailTitle vehicleId={vehicleId} />}
    >
      {vehicleId !== null && <VehicleDetailPanel key={vehicleId} vehicleId={vehicleId} />}
    </Dialog>
  );
}
