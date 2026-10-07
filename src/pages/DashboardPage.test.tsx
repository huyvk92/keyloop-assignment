import { act, screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { routes } from '@/app/router';
import { createI18n, i18n, LANGUAGE_STORAGE_KEY } from '@/i18n';
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

  it('translates the page title and "Dealership not found" in Vietnamese (AC-015.2)', async () => {
    await i18n.changeLanguage('vi');
    renderRoutes(routes, { route: '/dealerships/99' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy đại lý' }),
    ).toBeVisible();
    expect(document.title).toBe('Không tìm thấy đại lý · Bảng điều khiển tồn kho');
    expect(screen.getByRole('link', { name: 'Đến bảng điều khiển' })).toHaveAttribute('href', '/');
  });

  describe('dealership selector (US-008)', () => {
    it('shows the dealership from the URL as selected, so reload and share keep it (AC-008.3)', async () => {
      renderRoutes(routes, { route: '/dealerships/2' });

      await screen.findByRole('heading', { level: 1, name: 'Leeds' });
      expect(screen.getByRole('combobox', { name: 'Dealership' })).toHaveDisplayValue('Leeds');
    });

    it('switches dealership: new path, filters reset, only the new rows, focus kept (AC-008.2, BR-04, TA-10)', async () => {
      const listRequests: URL[] = [];
      server.use(
        http.get(apiUrl('/dealerships/:dealershipId/vehicles'), ({ request }) => {
          listRequests.push(new URL(request.url));
          // Fall through to the default handler.
        }),
      );
      const { user, router } = renderRoutes(routes, { route: '/dealerships/1?page=2' });
      expect(await screen.findByText('Showing 26-30 of 30')).toBeVisible();
      expect(screen.getByRole('row', { name: /STK-1026/ })).toBeVisible();
      listRequests.length = 0;

      const select = screen.getByRole('combobox', { name: 'Dealership' });
      await user.selectOptions(select, 'Leeds');

      expect(await screen.findByRole('heading', { level: 1, name: 'Leeds' })).toBeVisible();
      expect(router.state.location.pathname).toBe('/dealerships/2');
      expect(router.state.location.search).toBe('');
      expect(router.state.historyAction).toBe('PUSH');
      expect(await screen.findByText('Showing 1-4 of 4')).toBeVisible();
      expect(screen.getByRole('table', { name: 'Vehicles in stock at Leeds' })).toBeVisible();
      expect(screen.getByRole('row', { name: /STK-1101/ })).toBeVisible();
      expect(screen.queryByText(/STK-10\d\d/)).not.toBeInTheDocument();
      expect(listRequests.map((url) => `${url.origin}${url.pathname}`)).toEqual([
        apiUrl('/dealerships/2/vehicles'),
      ]);
      expect(listRequests[0]?.searchParams.get('page')).toBe('1');
      expect(document.title).toBe('Leeds · Inventory dashboard');
      // A keyboard user changing the select keeps their place (no jump to the h1).
      expect(screen.getByRole('combobox', { name: 'Dealership' })).toHaveFocus();
      expect(screen.getByRole('combobox', { name: 'Dealership' })).toHaveDisplayValue('Leeds');
    });

    it('returns to the previous dealership and its filters with Back, focusing the h1', async () => {
      const { user, router } = renderRoutes(routes, { route: '/dealerships/1?page=2' });
      await screen.findByText('Showing 26-30 of 30');
      await user.selectOptions(screen.getByRole('combobox', { name: 'Dealership' }), 'York');
      await screen.findByRole('heading', { level: 1, name: 'York' });

      await act(() => router.navigate(-1));

      const heading = await screen.findByRole('heading', { level: 1, name: 'Birmingham' });
      expect(router.state.location.search).toBe('?page=2');
      expect(await screen.findByText('Showing 26-30 of 30')).toBeVisible();
      expect(screen.getByRole('combobox', { name: 'Dealership' })).toHaveDisplayValue('Birmingham');
      expect(heading).toHaveFocus();
    });

    it('labels the selector in Vietnamese (BR-19)', async () => {
      await i18n.changeLanguage('vi');
      renderRoutes(routes, { route: '/dealerships/3' });

      expect(await screen.findByRole('combobox', { name: 'Đại lý' })).toHaveDisplayValue(
        'Manchester',
      );
    });
  });

  describe('language switcher (US-015)', () => {
    it('translates the page in place and keeps the dealership and URL state (AC-015.2)', async () => {
      const { user, router } = renderRoutes(routes, { route: '/dealerships/1?page=2' });
      expect(await screen.findByText('Showing 26-30 of 30')).toBeVisible();
      const heading = screen.getByRole('heading', { level: 1, name: 'Birmingham' });
      const before = router.state.location;

      await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'Tiếng Việt');

      expect(await screen.findByText('Hiển thị 26-30 / 30')).toBeVisible();
      expect(screen.getByRole('table', { name: 'Xe tồn kho tại Birmingham' })).toBeVisible();
      expect(screen.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
      expect(within(screen.getByRole('banner')).getByRole('link')).toHaveTextContent(
        'Bảng điều khiển tồn kho',
      );
      expect(document.documentElement.lang).toBe('vi');
      expect(document.title).toBe('Birmingham · Bảng điều khiển tồn kho');
      // Same page, not a reload: same heading element, same location, no navigation.
      expect(screen.getByRole('heading', { level: 1, name: 'Birmingham' })).toBe(heading);
      expect(router.state.location.pathname).toBe('/dealerships/1');
      expect(router.state.location.search).toBe('?page=2');
      expect(router.state.location.key).toBe(before.key);
      expect(screen.getByRole('combobox', { name: 'Ngôn ngữ' })).toHaveFocus();

      await user.selectOptions(screen.getByRole('combobox', { name: 'Ngôn ngữ' }), 'English');

      expect(await screen.findByText('Showing 26-30 of 30')).toBeVisible();
      expect(document.documentElement.lang).toBe('en');
      expect(document.title).toBe('Birmingham · Inventory dashboard');
      expect(router.state.location.search).toBe('?page=2');
    });

    it('opens in Vietnamese after a reload when Vietnamese was chosen (AC-015.3)', async () => {
      const { user, unmount } = renderRoutes(routes, { route: '/dealerships/2' });
      await screen.findByRole('heading', { level: 1, name: 'Leeds' });
      await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'vi');
      expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
      unmount();

      // A reload loses the in-memory language and re-initialises from storage (TA-25):
      // reset the app instance, then apply what a fresh initialisation resolves to.
      await i18n.changeLanguage('en');
      const reloaded = createI18n();
      expect(reloaded.language).toBe('vi');
      await i18n.changeLanguage(reloaded.language);
      renderRoutes(routes, { route: '/dealerships/2' });

      expect(await screen.findByText('Hiển thị 1-4 / 4')).toBeVisible();
      expect(screen.getByRole('combobox', { name: 'Ngôn ngữ' })).toHaveValue('vi');
      expect(document.documentElement.lang).toBe('vi');
    });
  });
});
