import { screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { routes } from '@/app/router';
import { apiUrl } from '@/lib/http';
import { fixtureDealerships } from '@/mocks/fixtures';
import { server } from '@/mocks/server';
import { renderRoutes } from '@/test/render';

describe('IndexRedirectPage', () => {
  it('redirects "/" to the alphabetically first dealership (AC-008.1)', async () => {
    const { router } = renderRoutes(routes, { route: '/' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Birmingham' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/dealerships/1');
  });

  it('shows a loading state while dealerships load', async () => {
    server.use(http.get(apiUrl('/dealerships'), () => delay('infinite')));
    renderRoutes(routes, { route: '/' });

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Loading dealerships…');
    expect(status).toHaveAttribute('aria-busy', 'true');
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

  it('shows an empty state when there are no dealerships', async () => {
    server.use(http.get(apiUrl('/dealerships'), () => HttpResponse.json({ items: [] })));
    renderRoutes(routes, { route: '/' });

    expect(await screen.findByText('No dealerships found')).toBeVisible();
  });
});
