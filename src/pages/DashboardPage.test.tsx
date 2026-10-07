import { act, screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { routes } from '@/app/router';
import { apiUrl } from '@/lib/http';
import { server } from '@/mocks/server';
import { renderRoutes } from '@/test/render';

describe('DashboardPage', () => {
  it('renders the selected dealership from the URL as the h1 and document title (AC-008.3)', async () => {
    renderRoutes(routes, { route: '/dealerships/2' });

    const heading = await screen.findByRole('heading', { level: 1, name: 'Leeds' });
    expect(heading).toHaveFocus();
    expect(document.title).toBe('Leeds · Inventory dashboard');
  });

  it('lists only the selected dealership vehicles (BR-04)', async () => {
    renderRoutes(routes, { route: '/dealerships/2' });

    expect(await screen.findByText('Showing 1-4 of 4')).toBeVisible();
    expect(screen.getByRole('table', { name: /vehicles in stock/i })).toBeVisible();
  });

  it('never shows the previous dealership rows while another dealership loads (BR-04)', async () => {
    const { router } = renderRoutes(routes, { route: '/dealerships/1' });
    expect(await screen.findByText('Showing 1-25 of 30')).toBeVisible();
    expect(screen.getByRole('row', { name: /STK-1001/ })).toBeVisible();

    server.use(http.get(apiUrl('/dealerships/4/vehicles'), () => delay('infinite')));
    await act(() => router.navigate('/dealerships/4'));

    expect(await screen.findByRole('heading', { level: 1, name: 'York' })).toBeVisible();
    expect(await screen.findByRole('status')).toHaveTextContent('Loading vehicles…');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('STK-1001')).not.toBeInTheDocument();
    expect(screen.queryByText('Showing 1-25 of 30')).not.toBeInTheDocument();
  });

  it.each(['/dealerships/99', '/dealerships/abc'])(
    'shows "Dealership not found" with a link home for %s',
    async (route) => {
      renderRoutes(routes, { route });

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Dealership not found' }),
      ).toBeVisible();
      expect(screen.getByRole('link', { name: /go to the dashboard/i })).toHaveAttribute(
        'href',
        '/',
      );
    },
  );

  it('shows an error with Retry when dealerships cannot be loaded', async () => {
    server.use(
      http.get(apiUrl('/dealerships'), () => HttpResponse.json(null, { status: 503 }), {
        once: true,
      }),
    );
    const { user } = renderRoutes(routes, { route: '/dealerships/3' });

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load dealership");
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Manchester' })).toBeVisible();
  });
});
