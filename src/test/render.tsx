import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

type Options = Omit<RenderOptions, 'wrapper'> & {
  /** Initial URL, e.g. '/bookings?status=open' */
  route?: string;
  /** Route pattern the UI is mounted at, e.g. '/bookings/:id' */
  path?: string;
};

/** Render UI inside a fresh QueryClient and an in-memory data router. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path = '*', ...options }: Options = {},
) {
  const queryClient = createTestQueryClient();
  const routes: RouteObject[] = [{ path, element: ui }];
  const router = createMemoryRouter(routes, { initialEntries: [route] });

  return {
    user: userEvent.setup(),
    queryClient,
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
      options,
    ),
  };
}

/** Render the real app route tree (lazy routes included) at a given URL. */
export function renderRoutes(routes: RouteObject[], { route = '/' }: { route?: string } = {}) {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  return {
    user: userEvent.setup(),
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}
