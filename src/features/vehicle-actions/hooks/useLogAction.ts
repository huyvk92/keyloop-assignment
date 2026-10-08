import type { CreateActionBody } from '@shared/api/actions';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryKeys } from '@/features/inventory';
import { logAction } from '../api/vehicle-detail.api';
import { vehicleKeys } from '../api/vehicle-detail.queries';
import { useLoggedByStore } from '../store';

type Options = {
  vehicleId: number;
  /** The vehicle's own dealership (from its detail), so only that dealership's data refreshes. */
  dealershipId: number;
};

/**
 * Logs an action (US-006). On success it refreshes the vehicle's dealership (list, aging section,
 * KPIs: AC-006.3, AC-010.2) and waits for the vehicle detail, so the new entry is at the top of
 * the history when "Action saved" appears. Errors are left to the caller (the form keeps its
 * input and shows a mapped message, AC-006.7). No retries: a POST is not idempotent.
 *
 * Only a successful save remembers the "Logged by" name, as the server stored it (US-012), so a
 * failed or rejected save never pre-fills the next form with it.
 */
export function useLogAction({ vehicleId, dealershipId }: Options) {
  const queryClient = useQueryClient();
  const setLoggedBy = useLoggedByStore((state) => state.setLoggedBy);
  return useMutation({
    mutationFn: (body: CreateActionBody) => logAction(vehicleId, body),
    onSuccess: async (entry) => {
      setLoggedBy(entry.loggedBy);
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.dealership(dealershipId) });
      await queryClient.invalidateQueries({ queryKey: vehicleKeys.detail(vehicleId) });
    },
  });
}
