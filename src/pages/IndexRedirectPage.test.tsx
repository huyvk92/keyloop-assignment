import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { routes } from '@/app/router';
import { apiUrl } from '@/lib/http';
import { fixtureDealerships } from '@/mocks/fixtures';
import { server } from '@/mocks/server';
import { preloadRouteModules, renderRoutes } from '@/test/render';

// Loading and empty states: see the states matrix (DashboardStates.test.tsx, T-039).
describe('IndexRedirectPage', () => {
  beforeAll(preloadRouteModules);

  it('redirects "/" to the alphabetically first dealership (AC-008.1)', async () => {
    const { router } = renderRoutes(routes, { route: '/' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Birmingham' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/dealerships/1');
  });

  it('shows an error with Retry, then redirects once loading succeeds', async () => {
    server.use(
      http.get(apiUrl('/dealerships'), () => HttpResponse.json(null, { status: 500 }), {
        once: true,
      }),
    );
    const { user, router } = renderRoutes(routes, { route: '/' });

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load dealerships");
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Birmingham' })).toBeVisible();
    expect(router.state.location.pathname).toBe(`/dealerships/${fixtureDealerships[0]?.id}`);
  });
});
