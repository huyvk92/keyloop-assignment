import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { delay, http } from 'msw';
import { routes } from '@/app/router';
import { createI18n, i18n, LANGUAGE_STORAGE_KEY } from '@/i18n';
import { apiUrl } from '@/lib/http';
import { mockActionStore } from '@/mocks/action-store';
import { server } from '@/mocks/server';
import { recordAnnouncements } from '@/test/announcements';
import { startManualClock, stopManualClock } from '@/test/manual-clock';
import { preloadRouteModules, renderRoutes } from '@/test/render';

const AGING_SEARCH = '?agingOnly=true&sort=age&order=desc&pageSize=10';
/** The aging section's request (TA-11), as opposed to the main list's. */
const isAgingRequest = (url: URL) => url.search === AGING_SEARCH;

/**
 * Opens a vehicle with `trigger`, logs "Price Reduction Planned" / "Cut 5%" / "Jane" and waits for
 * the confirmation. Short pasted values keep it fast under load, and every query is scoped to
 * this test's dialog.
 */
async function logActionFrom(user: UserEvent, trigger: HTMLElement) {
  await user.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: /STK-/ });
  await user.click(within(dialog).getByRole('radio', { name: 'Price Reduction Planned' }));
  await user.click(within(dialog).getByRole('textbox', { name: 'Note (optional)' }));
  await user.paste('Cut 5%');
  await user.click(within(dialog).getByRole('textbox', { name: 'Logged by' }));
  await user.paste('Jane');
  await user.click(within(dialog).getByRole('button', { name: 'Save action' }));
  expect(await within(dialog).findByText('Action saved')).toBeVisible();
  return dialog;
}

describe('DashboardPage', () => {
  beforeAll(preloadRouteModules);

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
    // The match count is a second status region; the list's loading status is the one asserted.
    expect(await screen.findByText('Loading vehicles…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('STK-1001')).not.toBeInTheDocument();
    expect(screen.queryByText('Showing 1-25 of 30')).not.toBeInTheDocument();
  });

  it('canonicalises a dirty URL with exactly one replace navigation (TA-09)', async () => {
    const { router } = renderRoutes(routes, {
      route: '/dealerships/1?make=Ford&pageSize=999&page=1&bogus=1',
    });
    const navigate = vi.spyOn(router, 'navigate');

    expect(await screen.findByText('6 vehicles match your filters')).toBeVisible();

    expect(router.state.location.search).toBe('?make=Ford');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[1]).toMatchObject({ replace: true });
  });

  it('opens a shared ?sort=price&order=desc link with that sort applied (AC-011.3)', async () => {
    const listRequests: URLSearchParams[] = [];
    server.use(
      http.get(apiUrl('/dealerships/:dealershipId/vehicles'), ({ request }) => {
        const url = new URL(request.url);
        if (!isAgingRequest(url)) listRequests.push(url.searchParams);
      }),
    );
    const { router } = renderRoutes(routes, { route: '/dealerships/1?sort=price&order=desc' });

    const table = await screen.findByRole('table', { name: 'Vehicles in stock at Birmingham' });
    expect(router.state.location.search).toBe('?sort=price&order=desc');
    expect(listRequests.at(-1)?.get('sort')).toBe('price');
    expect(listRequests.at(-1)?.get('order')).toBe('desc');
    // Only the price cells (GBP for Birmingham), via a cheap text query instead of reading all
    // 25 x 13 cells by role.
    const prices = within(table)
      .getAllByText(/^£[\d,.]+$/)
      .map((cell) => Number(cell.textContent?.replace(/[^\d]/g, '')));
    expect(prices).toHaveLength(25);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
    expect(new Set(prices).size).toBeGreaterThan(1);
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

  it('translates the page title and "Dealership not found" in Vietnamese (AC-015.2)', async () => {
    await i18n.changeLanguage('vi');
    renderRoutes(routes, { route: '/dealerships/99' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy đại lý' }),
    ).toBeVisible();
    expect(document.title).toBe('Không tìm thấy đại lý · Bảng điều khiển tồn kho');
    expect(screen.getByRole('link', { name: 'Đến bảng điều khiển' })).toHaveAttribute('href', '/');
  });

  describe('aging section (US-004)', () => {
    it('shows the KPIs, then the aging stock, then the filters and the list, without any filter (AC-004.1, AC-005.4)', async () => {
      renderRoutes(routes, { route: '/dealerships/1?make=Toyota' });

      const aging = await screen.findByRole('region', { name: 'Aging stock' });
      const list = await within(aging).findByRole('list', { name: 'Aging vehicles, oldest first' });
      // Oldest first and unaffected by the list's make filter: the 10 oldest of 19.
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(10);
      expect(items[0]).toHaveTextContent('STK-1001');
      expect(items[0]).toHaveTextContent('200 days');
      expect(items[9]).toHaveTextContent('STK-1010');
      expect(
        within(aging).getByRole('button', { name: 'View all 19 aging vehicles' }),
      ).toBeVisible();
      // Page order: KPIs, aging section, filters, then the list (AC-005.4 layout).
      const kpis = screen.getByRole('region', { name: 'Inventory summary' });
      const filters = screen.getByRole('search', { name: 'Filter vehicles' });
      const vehicleList = screen.getByRole('region', { name: 'Vehicle list' });
      expect(kpis.compareDocumentPosition(aging)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(aging.compareDocumentPosition(filters)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(filters.compareDocumentPosition(vehicleList)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('"View all" replaces the filters with Aging only, shows exactly N and focuses the results (TA-29, AC-004.3)', async () => {
      const { user, router } = renderRoutes(routes, {
        route: '/dealerships/1?make=Ford&q=stk&minAge=10&sort=price',
      });
      expect(await screen.findByText('6 vehicles match your filters')).toBeVisible();

      await user.click(await screen.findByRole('button', { name: 'View all 19 aging vehicles' }));

      // Other filters and the sort are cleared, so the list holds the 19 the button promised.
      expect(router.state.location.search).toBe('?agingOnly=true');
      expect(router.state.historyAction).toBe('PUSH');
      expect(screen.getByRole('heading', { level: 2, name: 'Vehicle list' })).toHaveFocus();
      expect(await screen.findByText('19 vehicles match your filters')).toBeVisible();
      expect(screen.getByText('Showing 1-19 of 19')).toBeVisible();
      expect(screen.getByRole('checkbox', { name: 'Aging only (over 90 days)' })).toBeChecked();
      expect(screen.getByRole('combobox', { name: 'Make' })).toHaveDisplayValue('All makes');
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
      expect(screen.getByRole('textbox', { name: 'Minimum days' })).toHaveValue('');
    });

    it('sends the same summary and aging requests in Vietnamese as in English (BR-19)', async () => {
      const requestsIn = async (language: 'en' | 'vi', viewAllLabel: string) => {
        await i18n.changeLanguage(language);
        const sent: string[] = [];
        server.use(
          http.get(apiUrl('/dealerships/:dealershipId/vehicles'), ({ request }) => {
            const url = new URL(request.url);
            if (isAgingRequest(url)) sent.push(url.href);
          }),
          http.get(apiUrl('/dealerships/:dealershipId/summary'), ({ request }) => {
            sent.push(request.url);
          }),
        );
        const { unmount } = renderRoutes(routes, { route: '/dealerships/1' });
        expect(await screen.findByRole('button', { name: viewAllLabel })).toBeVisible();
        await waitFor(() => expect(sent).toHaveLength(2));
        unmount();
        server.resetHandlers();
        return sent.sort();
      };

      const english = await requestsIn('en', 'View all 19 aging vehicles');
      const vietnamese = await requestsIn('vi', 'Xem tất cả 19 xe tồn kho lâu');

      // One summary and one aging request each; no language or locale in the params.
      expect(english).toEqual([
        apiUrl('/dealerships/1/summary'),
        `${apiUrl('/dealerships/1/vehicles')}${AGING_SEARCH}`,
      ]);
      expect(vietnamese).toEqual(english);
    });

    it('shows "No aging stock" for a dealership without aging vehicles (AC-004.2)', async () => {
      renderRoutes(routes, { route: '/dealerships/3' });

      const aging = await screen.findByRole('region', { name: 'Aging stock' });
      expect(await within(aging).findByText('No aging stock')).toBeVisible();
    });
  });

  describe('dealership selector (US-008)', () => {
    it('shows the dealership from the URL as selected, so reload and share keep it (AC-008.3)', async () => {
      renderRoutes(routes, { route: '/dealerships/2' });

      await screen.findByRole('heading', { level: 1, name: 'Leeds' });
      expect(screen.getByRole('combobox', { name: 'Dealership' })).toHaveDisplayValue('Leeds');
    });

    it('switches dealership: new path, filters reset, only the new rows, focus kept (AC-008.2, BR-04, TA-10)', async () => {
      const listRequests: URL[] = [];
      const agingRequests: URL[] = [];
      const summaryRequests: URL[] = [];
      server.use(
        http.get(apiUrl('/dealerships/:dealershipId/vehicles'), ({ request }) => {
          const url = new URL(request.url);
          (isAgingRequest(url) ? agingRequests : listRequests).push(url);
          // Fall through to the default handler.
        }),
        http.get(apiUrl('/dealerships/:dealershipId/summary'), ({ request }) => {
          summaryRequests.push(new URL(request.url));
        }),
      );
      const { user, router } = renderRoutes(routes, { route: '/dealerships/1?page=2' });
      expect(await screen.findByText('Showing 26-30 of 30')).toBeVisible();
      expect(screen.getByRole('row', { name: /STK-1026/ })).toBeVisible();
      listRequests.length = 0;
      agingRequests.length = 0;
      summaryRequests.length = 0;

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
      // The aging section follows the dealership too, and shows only Leeds stock (TA-11).
      expect(agingRequests.map((url) => `${url.origin}${url.pathname}`)).toEqual([
        apiUrl('/dealerships/2/vehicles'),
      ]);
      expect(
        await screen.findByRole('button', { name: 'View all 4 aging vehicles' }),
      ).toBeVisible();
      // So do the KPIs (AC-008.2).
      expect(summaryRequests.map((url) => url.href)).toEqual([apiUrl('/dealerships/2/summary')]);
      const kpis = screen.getByRole('region', { name: 'Inventory summary' });
      expect(within(kpis).getByRole('definition', { name: 'Total vehicles' })).toHaveTextContent(
        '4',
      );
      expect(document.title).toBe('Leeds · Inventory dashboard');
      // A keyboard user changing the select keeps their place (no jump to the h1).
      expect(screen.getByRole('combobox', { name: 'Dealership' })).toHaveFocus();
      expect(screen.getByRole('combobox', { name: 'Dealership' })).toHaveDisplayValue('Leeds');
    });

    it('resets every filter control when switching dealership (AC-008.2, TA-10)', async () => {
      const { user, router } = renderRoutes(routes, {
        route: '/dealerships/1?make=Ford&agingOnly=true&q=stk&minAge=10',
      });
      expect(await screen.findByText('3 vehicles match your filters')).toBeVisible();
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('stk');

      await user.selectOptions(screen.getByRole('combobox', { name: 'Dealership' }), 'Leeds');

      expect(await screen.findByText('4 vehicles in stock')).toBeVisible();
      expect(router.state.location.search).toBe('');
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
      expect(screen.getByRole('combobox', { name: 'Make' })).toHaveDisplayValue('All makes');
      expect(screen.getByRole('checkbox', { name: 'Aging only (over 90 days)' })).not.toBeChecked();
      expect(screen.getByRole('textbox', { name: 'Minimum days' })).toHaveValue('');
    });

    it('restores filters and results from the URL on reload (AC-002.7)', async () => {
      const url = '/dealerships/1?make=Ford&ageBucket=over-90';
      const { unmount } = renderRoutes(routes, { route: url });
      expect(await screen.findByText('3 vehicles match your filters')).toBeVisible();
      const rows = screen.getAllByRole('row').map((row) => row.textContent);
      unmount();

      renderRoutes(routes, { route: url });

      expect(await screen.findByText('3 vehicles match your filters')).toBeVisible();
      expect(screen.getAllByRole('row').map((row) => row.textContent)).toEqual(rows);
      expect(screen.getByRole('combobox', { name: 'Make' })).toHaveDisplayValue('Ford');
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

    it('does not announce a sort again after switching dealership and coming Back (AC-011.3)', async () => {
      const { user, router } = renderRoutes(routes, { route: '/dealerships/1' });
      await screen.findByText('Showing 1-25 of 30');
      await user.click(screen.getByRole('button', { name: 'List price' }));
      expect(await screen.findByText('Sorted by price, ascending')).toBeInTheDocument();
      await user.selectOptions(screen.getByRole('combobox', { name: 'Dealership' }), 'Leeds');
      await screen.findByText('Showing 1-4 of 4');
      const { announcements } = recordAnnouncements();

      await act(() => router.navigate(-1));

      await screen.findByRole('heading', { level: 1, name: 'Birmingham' });
      await screen.findByText('Showing 1-25 of 30');
      expect(screen.getByRole('columnheader', { name: 'List price' })).toHaveAttribute(
        'aria-sort',
        'ascending',
      );
      expect(announcements.filter((text) => text.startsWith('Sorted'))).toEqual([]);
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
  describe('refresh (US-009, T-034)', () => {
    it('shows "Last updated" and Refresh next to the h1, above the KPIs', async () => {
      renderRoutes(routes, { route: '/dealerships/1' });

      const heading = await screen.findByRole('heading', { level: 1, name: 'Birmingham' });
      const refresh = screen.getByRole('button', { name: 'Refresh' });
      expect(await screen.findByText(/^Last updated \d{2}:\d{2}$/)).toBeVisible();
      const kpis = screen.getByRole('region', { name: 'Inventory summary' });
      expect(heading.compareDocumentPosition(refresh)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(refresh.compareDocumentPosition(kpis)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('refreshes the open vehicle too, keeping the URL and the typed form input (AC-009.1, AC-009.3)', async () => {
      const { user, router } = renderRoutes(routes, {
        route: '/dealerships/1?ageBucket=over-90&sort=price&order=desc',
      });
      await user.click(await screen.findByRole('button', { name: 'View STK-1002' }));
      const dialog = await screen.findByRole('dialog', { name: /STK-1002/ });
      await user.click(within(dialog).getByRole('radio', { name: 'Under Review' }));
      await user.click(within(dialog).getByRole('textbox', { name: 'Note (optional)' }));
      await user.paste('Half typed');
      const before = router.state.location;
      // Another manager logs an action for this vehicle on the server.
      mockActionStore.log(2, { status: 'Marketing Promotion', loggedBy: 'Sam Patel' });

      // jsdom has no inert background behind the modal, so the page button can be clicked here;
      // in a browser the same refetch comes from the 60 s poll or window focus (ADR-007).
      await user.click(screen.getByRole('button', { name: 'Refresh' }));

      await waitFor(() =>
        expect(
          within(
            within(dialog).getByRole('list', { name: 'Action history, newest first' }),
          ).getAllByRole('listitem')[0],
        ).toHaveTextContent('Logged by Sam Patel'),
      );
      expect(within(dialog).getByRole('radio', { name: 'Under Review' })).toBeChecked();
      expect(within(dialog).getByRole('textbox', { name: 'Note (optional)' })).toHaveValue(
        'Half typed',
      );
      expect(router.state.location.search).toBe('?ageBucket=over-90&sort=price&order=desc');
      expect(router.state.location.key).toBe(before.key);
    });
  });

  describe('automatic refresh every 60 s (AC-009.1, AC-009.3, NFR-05, TA-14)', () => {
    type Polled = 'summary' | 'aging' | 'list' | 'detail';
    /** Every polled request with the (fake) time it was made; the default handlers answer. */
    function recordPolledRequests() {
      const requests: { kind: Polled; at: number }[] = [];
      server.use(
        http.get(apiUrl('/dealerships/:dealershipId/vehicles'), ({ request }) => {
          const kind = isAgingRequest(new URL(request.url)) ? 'aging' : 'list';
          requests.push({ kind, at: Date.now() });
        }),
        http.get(apiUrl('/dealerships/:dealershipId/summary'), () => {
          requests.push({ kind: 'summary', at: Date.now() });
        }),
        http.get(apiUrl('/vehicles/:vehicleId'), () => {
          requests.push({ kind: 'detail', at: Date.now() });
        }),
      );
      const kinds = () => requests.map(({ kind }) => kind).sort();
      return { requests, kinds };
    }

    afterEach(() => {
      // The focus manager is global: back to "follow the document" for the next test.
      focusManager.setFocused(undefined);
      stopManualClock();
    });

    it('polls every section and the open vehicle after exactly 60 s, keeping typed input and the URL', async () => {
      startManualClock();
      const { requests, kinds } = recordPolledRequests();
      const { router } = renderRoutes(routes, {
        route: '/dealerships/1?ageBucket=over-90&sort=price&order=desc',
      });
      const user = userEvent.setup({ delay: null });
      await user.click(await screen.findByRole('button', { name: 'View STK-1002' }));
      const dialog = await screen.findByRole('dialog', { name: /STK-1002/ });
      await user.click(await within(dialog).findByRole('radio', { name: 'Under Review' }));
      await user.click(within(dialog).getByRole('textbox', { name: 'Note (optional)' }));
      await user.paste('Half typed');
      await waitFor(() => expect(kinds()).toEqual(['aging', 'detail', 'list', 'summary']));
      const loadedAt = new Map(requests.map(({ kind, at }) => [kind, at]));
      const before = router.state.location;
      requests.length = 0;
      // Another manager logs an action for this vehicle on the server.
      mockActionStore.log(2, { status: 'Marketing Promotion', loggedBy: 'Sam Patel' });

      // 1 ms before the first section is due, nothing has been polled.
      const firstDue = Math.min(...loadedAt.values()) + 60_000;
      await act(() => vi.advanceTimersByTimeAsync(firstDue - 1 - Date.now()));
      expect(requests).toEqual([]);
      // Within the next 60 s every section and the drawer poll once, each one 60 s after its own
      // load, never earlier. (The drawer's interval starts when its observer subscribes, a render
      // tick after its fetch began, so its gap can be a few ms over 60 s.)
      await act(() => vi.advanceTimersByTimeAsync(60_000));
      expect(kinds()).toEqual(['aging', 'detail', 'list', 'summary']);
      for (const { kind, at } of requests) {
        const gap = at - (loadedAt.get(kind) ?? 0);
        expect(gap).toBeGreaterThanOrEqual(60_000);
        expect(gap).toBeLessThan(61_000);
      }

      await waitFor(() =>
        expect(
          within(
            within(dialog).getByRole('list', { name: 'Action history, newest first' }),
          ).getAllByRole('listitem')[0],
        ).toHaveTextContent('Logged by Sam Patel'),
      );
      await waitFor(() =>
        expect(screen.getByRole('row', { name: /STK-1002/ })).toHaveTextContent(
          'Marketing Promotion',
        ),
      );
      expect(within(dialog).getByRole('radio', { name: 'Under Review' })).toBeChecked();
      expect(within(dialog).getByRole('textbox', { name: 'Note (optional)' })).toHaveValue(
        'Half typed',
      );
      expect(router.state.location.search).toBe('?ageBucket=over-90&sort=price&order=desc');
      expect(router.state.location.key).toBe(before.key);
    });

    it('does not poll while the window is unfocused, and refetches once on focus (TA-14)', async () => {
      startManualClock();
      const { requests, kinds } = recordPolledRequests();
      renderRoutes(routes, { route: '/dealerships/1' });
      await screen.findByText('Showing 1-25 of 30');
      await waitFor(() => expect(kinds()).toEqual(['aging', 'list', 'summary']));
      requests.length = 0;

      act(() => focusManager.setFocused(false));
      await act(() => vi.advanceTimersByTimeAsync(120_000));
      expect(requests).toEqual([]);

      act(() => focusManager.setFocused(true));
      await waitFor(() => expect(kinds()).toEqual(['aging', 'list', 'summary']));
      // One refetch each: nothing else follows until the next interval.
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      expect(kinds()).toEqual(['aging', 'list', 'summary']);
    });
  });

  describe('vehicle drawer (T-030, T-032)', () => {
    it('opens a vehicle from its table row and returns focus to "View" on Escape (AC-004.4)', async () => {
      const { user } = renderRoutes(routes, { route: '/dealerships/1' });
      const view = await screen.findByRole('button', { name: 'View STK-1001' });

      await user.click(view);

      const dialog = await screen.findByRole('dialog', { name: 'STK-1001 · Toyota Corolla' });
      expect(within(dialog).getByRole('heading', { name: 'Action history' })).toBeVisible();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(view).toHaveFocus();
    });

    it('opens a vehicle from the aging section (AC-004.4)', async () => {
      const { user } = renderRoutes(routes, { route: '/dealerships/1' });
      const aging = await screen.findByRole('list', { name: 'Aging vehicles, oldest first' });

      await user.click(within(aging).getByRole('button', { name: /STK-1002/ }));

      expect(await screen.findByRole('dialog', { name: /STK-1002/ })).toBeVisible();
    });

    it('updates the list row after logging, without a refresh (AC-006.3, AC-010.2)', async () => {
      const { user } = renderRoutes(routes, { route: '/dealerships/1' });
      const row = await screen.findByRole('row', { name: /STK-1002/ });
      expect(within(row).getByText('No action')).toBeVisible();

      await logActionFrom(user, within(row).getByRole('button', { name: 'View STK-1002' }));

      await waitFor(() =>
        expect(screen.getByRole('row', { name: /STK-1002/ })).toHaveTextContent(
          'Price Reduction Planned',
        ),
      );
    });

    it('updates the aging section after logging, without a refresh (AC-010.2)', async () => {
      const { user } = renderRoutes(routes, { route: '/dealerships/1' });
      const aging = await screen.findByRole('list', { name: 'Aging vehicles, oldest first' });
      const item = within(aging).getByRole('button', { name: /STK-1002/ });
      expect(item).toHaveTextContent('No action');

      await logActionFrom(user, item);

      await waitFor(() =>
        expect(within(aging).getByRole('button', { name: /STK-1002/ })).toHaveTextContent(
          'Price Reduction Planned',
        ),
      );
    });

    it('drops the "Needs attention" label and lowers the KPI by 1 after logging, without a refresh (AC-010.1, AC-010.2)', async () => {
      const { user } = renderRoutes(routes, { route: '/dealerships/1' });
      const row = await screen.findByRole('row', { name: /STK-1002/ });
      const kpi = () =>
        within(screen.getByRole('region', { name: 'Inventory summary' })).getByRole('definition', {
          name: 'Needs attention',
        });
      const agingItem = () =>
        within(screen.getByRole('list', { name: 'Aging vehicles, oldest first' })).getByRole(
          'button',
          { name: /STK-1002/ },
        );
      // Birmingham fixtures: 19 aging, 7 of them with an action.
      await waitFor(() => expect(kpi()).toHaveTextContent(/^12$/));
      expect(within(row).getByText('Needs attention')).toBeVisible();
      expect(await within(agingItem()).findByText('Needs attention')).toBeVisible();

      await logActionFrom(user, within(row).getByRole('button', { name: 'View STK-1002' }));

      await waitFor(() => expect(kpi()).toHaveTextContent(/^11$/));
      await waitFor(() =>
        expect(
          within(screen.getByRole('row', { name: /STK-1002/ })).queryByText('Needs attention'),
        ).not.toBeInTheDocument(),
      );
      await waitFor(() =>
        expect(within(agingItem()).queryByText('Needs attention')).not.toBeInTheDocument(),
      );
      // Other vehicles keep their label.
      expect(
        within(screen.getByRole('row', { name: /STK-1003/ })).getByText('Needs attention'),
      ).toBeVisible();
    });

    it('moves focus to the list on close when the vehicle left a "needs attention" list (ADR-006)', async () => {
      const { user } = renderRoutes(routes, { route: '/dealerships/1?needsAttention=true' });
      const view = await screen.findByRole('button', { name: 'View STK-1002' });

      await logActionFrom(user, view);
      // With an action it no longer needs attention (BR-16): the refetched list drops its row.
      await waitFor(() =>
        expect(screen.queryByRole('row', { name: /STK-1002/ })).not.toBeInTheDocument(),
      );
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Vehicle list' })).toHaveFocus();
      expect(document.body).not.toHaveFocus();
    });

    it('still shows a logged action after a reload (AC-007.1)', async () => {
      const view = renderRoutes(routes, { route: '/dealerships/1' });
      await logActionFrom(view.user, await screen.findByRole('button', { name: 'View STK-1002' }));
      view.unmount();

      // A fresh QueryClient and router: everything comes from the (mock) API again.
      const { user } = renderRoutes(routes, { route: '/dealerships/1' });
      const row = await screen.findByRole('row', { name: /STK-1002/ });
      expect(row).toHaveTextContent('Price Reduction Planned');
      await user.click(within(row).getByRole('button', { name: 'View STK-1002' }));

      const dialog = await screen.findByRole('dialog', { name: /STK-1002/ });
      const list = await within(dialog).findByRole('list', {
        name: 'Action history, newest first',
      });
      const [latest] = within(list).getAllByRole('listitem');
      expect(latest).toHaveTextContent('Price Reduction Planned');
      expect(latest).toHaveTextContent('Cut 5%');
      expect(latest).toHaveTextContent('Logged by Jane');
      // The current action is the first fact (`<dd>` = "definition").
      expect(within(dialog).getAllByRole('definition')[0]).toHaveTextContent(
        'Price Reduction Planned',
      );
    });

    it('closes the drawer when the dealership changes, and keeps it closed on Back (BR-04, TA-16)', async () => {
      const { user, router } = renderRoutes(routes, { route: '/dealerships/1' });
      await user.click(await screen.findByRole('button', { name: 'View STK-1001' }));
      await screen.findByRole('dialog', { name: /STK-1001/ });

      await act(() => router.navigate('/dealerships/2'));

      await screen.findByRole('heading', { level: 1, name: 'Leeds' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.body).not.toHaveClass('overflow-hidden');

      await act(() => router.navigate(-1));

      await screen.findByRole('heading', { level: 1, name: 'Birmingham' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
