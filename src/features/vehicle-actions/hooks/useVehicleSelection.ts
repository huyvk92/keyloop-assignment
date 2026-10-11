import { useState } from 'react';

type Selection = { dealershipId: number | undefined; vehicleId: number };

/**
 * The vehicle open in the drawer, as local page state (TA-16, not in the URL). It belongs to the
 * dealership it was opened in: when the dealership changes (e.g. browser Back), the selection is
 * dropped during render, so the drawer closes and never shows across dealerships (BR-04).
 */
export function useVehicleSelection(dealershipId: number | undefined) {
  const [selection, setSelection] = useState<Selection | null>(null);
  if (selection && selection.dealershipId !== dealershipId) setSelection(null);

  return {
    selectedVehicleId:
      selection && selection.dealershipId === dealershipId ? selection.vehicleId : null,
    selectVehicle: (vehicleId: number) => setSelection({ dealershipId, vehicleId }),
    clearSelection: () => setSelection(null),
  };
}
