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

/** Calls every `lazy` of the tree (function or per-property object form), depth first. */
function loadLazyRoutes(routeList: RouteObject[]): Promise<unknown>[] {
  return routeList.flatMap((route) => {
    const { lazy, children = [] } = route;
    const loads =
      typeof lazy === 'function'
        ? [lazy()]
        : Object.values(lazy ?? {}).map((load: unknown) =>
            typeof load === 'function' ? Promise.resolve(load()) : Promise.resolve(),
          );
    return [...loads, ...loadLazyRoutes(children)];
  });
}

/**
 * Resolves every lazy route of the app router once, for `beforeAll` in files using
 * `renderRoutes`. The list comes from `routes` itself, so a new lazy page is covered without
 * editing this helper. The router still resolves each route's `lazy()` per test; only the first,
 * cold import (module transform, slower under coverage and parallel files) is taken out of the
 * `findBy*` waits (`asyncUtilTimeout`, src/test/setup.ts), so they time UI behaviour rather than
 * the bundler. The router module is imported here, not at the top, so files that never call this
 * don't create the app's browser router.
 */
export async function preloadRouteModules() {
  const { routes } = await import('@/app/router');
  await Promise.all(loadLazyRoutes(routes));
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
