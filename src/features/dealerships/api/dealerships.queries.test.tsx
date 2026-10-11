import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { dealershipKeys, useDealership } from '@/features/dealerships';
import { createTestQueryClient } from '@/test/render';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

describe('dealership queries', () => {
  it('uses a stable key for the list', () => {
    expect(dealershipKeys.list()).toEqual(['dealerships', 'list']);
  });

  it('selects one dealership by id from the list', async () => {
    const { result } = renderHook(() => useDealership(3), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: 3, name: 'Manchester', currency: 'GBP' });
  });

  it.each([99, undefined])('returns undefined data for id %s', async (id) => {
    const { result } = renderHook(() => useDealership(id), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
