import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import {
  inventoryKeys,
  summaryOptions,
  useAgingStock,
  useInventorySummary,
} from '@/features/inventory';
import { apiUrl } from '@/lib/http';
import { EXAMPLE_ACTION_BODY, mockActionStore } from '@/mocks/action-store';
import { server } from '@/mocks/server';
import { createTestQueryClient } from '@/test/render';
import { useVehicleDetail, vehicleDetailOptions, vehicleKeys } from '../api/vehicle-detail.queries';
import { useLogAction } from './useLogAction';

/** Vehicle 2 (Birmingham, 194 days, no action) is a "needs attention" vehicle (BR-16). */
const VEHICLE_ID = 2;
const DEALERSHIP_ID = 1;
const OTHER_DEALERSHIP_ID = 2;

function setup() {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () => ({
      summary: useInventorySummary(DEALERSHIP_ID),
      aging: useAgingStock(DEALERSHIP_ID),
      detail: useVehicleDetail(VEHICLE_ID),
      logAction: useLogAction({ vehicleId: VEHICLE_ID, dealershipId: DEALERSHIP_ID }),
      // Mounted, so an invalidation of the other dealership would refetch it right away.
      otherSummary: useInventorySummary(OTHER_DEALERSHIP_ID),
    }),
    { wrapper },
  );
  return { ...view, queryClient };
}

const agingItem = (result: ReturnType<typeof setup>['result']) =>
  result.current.aging.data?.items.find((v) => v.id === VEHICLE_ID);

describe('useLogAction (T-032)', () => {
  it('posts the action, then refreshes the dealership and the vehicle (AC-006.3, AC-010.2)', async () => {
    const { result, queryClient } = setup();
    await waitFor(() => expect(result.current.summary.data).toBeDefined());
    await waitFor(() => expect(result.current.aging.data).toBeDefined());
    await waitFor(() => expect(result.current.detail.data).toBeDefined());
    const attentionBefore = result.current.summary.data?.needsAttentionCount ?? 0;
    expect(agingItem(result)?.needsAttention).toBe(true);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await act(() => result.current.logAction.mutateAsync(EXAMPLE_ACTION_BODY));

    expect(mockActionStore.appended()).toEqual([
      expect.objectContaining({ vehicleId: VEHICLE_ID, ...EXAMPLE_ACTION_BODY }),
    ]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: inventoryKeys.dealership(DEALERSHIP_ID) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: vehicleKeys.detail(VEHICLE_ID) });
    // The detail is awaited: the new entry is already first when the mutation settles.
    expect(
      queryClient.getQueryData(vehicleDetailOptions(VEHICLE_ID).queryKey)?.actions[0],
    ).toMatchObject(EXAMPLE_ACTION_BODY);
    await waitFor(() =>
      expect(result.current.summary.data?.needsAttentionCount).toBe(attentionBefore - 1),
    );
    await waitFor(() =>
      expect(agingItem(result)?.currentAction?.status).toBe('Price Reduction Planned'),
    );
    expect(agingItem(result)?.needsAttention).toBe(false);
  });

  it('never refreshes another dealership (BR-04)', async () => {
    let otherDealershipRequests = 0;
    server.use(
      http.get(apiUrl(`/dealerships/${OTHER_DEALERSHIP_ID}/*`), () => {
        otherDealershipRequests += 1; // counted, then the default handler answers
      }),
    );
    const { result, queryClient } = setup();
    await waitFor(() => expect(result.current.summary.data).toBeDefined());
    await waitFor(() => expect(result.current.otherSummary.data).toBeDefined());
    const otherKey = summaryOptions(OTHER_DEALERSHIP_ID).queryKey;
    const otherUpdatedAt = queryClient.getQueryState(otherKey)?.dataUpdatedAt;
    otherDealershipRequests = 0;

    await act(() => result.current.logAction.mutateAsync(EXAMPLE_ACTION_BODY));
    // The own dealership refetches (its summary changes), so any stray refetch had time to start.
    await waitFor(() =>
      expect(queryClient.getQueryState(summaryOptions(DEALERSHIP_ID).queryKey)?.isInvalidated).toBe(
        false,
      ),
    );
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(otherKey)?.dataUpdatedAt).toBe(otherUpdatedAt);
    expect(otherDealershipRequests).toBe(0);
  });

  it('rejects and refreshes nothing when the save fails', async () => {
    const { result, queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await expect(
        result.current.logAction.mutateAsync({ ...EXAMPLE_ACTION_BODY, loggedBy: ' ' }),
      ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(mockActionStore.appended()).toEqual([]);
  });
});
