import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { FilterBar, VehicleTable } from '@/features/inventory';
import { i18n } from '@/i18n';
import { apiUrl } from '@/lib/http';
import {
  buildCurrentAction,
  buildDealership,
  buildVehicle,
  buildVehiclePage,
} from '@/mocks/fixtures';
import { server } from '@/mocks/server';
import { recordAnnouncements } from '@/test/announcements';
import { renderWithProviders } from '@/test/render';

const birmingham = buildDealership({ id: 1, name: 'Birmingham' });
const york = buildDealership({ id: 4, name: 'York' });
const vehiclesUrl = (id: number) => apiUrl(`/dealerships/${id}/vehicles`);
/**
 * Text of every live status region. The table always holds one (empty until the user sorts,
 * AC-011.3), so "nothing announced here" is `['']`.
 */
const statusTexts = () => screen.queryAllByRole('status').map((status) => status.textContent);

function renderTable(dealership = birmingham, search = '') {
  return renderWithProviders(<VehicleTable dealership={dealership} />, {
    route: `/dealerships/${dealership.id}${search}`,
    path: '/dealerships/:dealershipId',
  });
}

/** The column headers' accessible names, in order (what a screen reader reads per cell). */
function expectHeaderNames(table: HTMLElement, names: string[]) {
  const headers = within(table).getAllByRole('columnheader');
  expect(headers).toHaveLength(names.length);
  headers.forEach((header, index) => expect(header).toHaveAccessibleName(names[index]));
}

const COLUMNS = [
  'Stock no.',
  'Make',
  'Model',
  'Year',
  'Days in stock',
  'Aging',
  'Current action',
  'List price',
  'Stock-in date',
  'Mileage',
  'Trim',
  'Colour',
  'VIN',
];

describe('VehicleTable', () => {
  it('renders all 13 columns with formatted values (AC-001.1, AC-001.7)', async () => {
    const vehicle = buildVehicle({
      vin: '1FADP3F2XJL123456',
      stockNumber: 'STK-1042',
      make: 'Ford',
      model: 'Focus',
      modelYear: 2021,
      trim: 'Titanium',
      colour: 'Blue',
      mileage: 12345,
      listPriceMinor: 2_599_000,
      stockInDate: '2026-06-01',
      daysInStock: 128,
      currentAction: buildCurrentAction({
        status: 'Price Reduction Planned',
        loggedBy: 'Jane Smith',
        loggedAt: '2026-10-07T13:32:00.000Z',
      }),
    });
    server.use(http.get(vehiclesUrl(1), () => HttpResponse.json(buildVehiclePage([vehicle]))));
    renderTable();

    const table = await screen.findByRole('table', { name: 'Vehicles in stock at Birmingham' });
    expectHeaderNames(table, COLUMNS);
    const [, row] = within(table).getAllByRole('row');
    if (!row) throw new Error('expected a data row');
    const cells = within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(cells).toEqual([
      'STK-1042',
      'Ford',
      'Focus',
      '2021',
      '128',
      'Aging',
      'Price Reduction PlannedJane Smith · 07 Oct 2026, 14:32',
      '£25,990',
      '01 Jun 2026',
      '12,345 mi',
      'Titanium',
      'Blue',
      '1FADP3F2XJL123456',
    ]);
  });

  it('labels aging rows with text and shows "No action" when there is no action (AC-003.4, AC-007.5)', async () => {
    const aging = buildVehicle({ id: 1, stockNumber: 'STK-0001', daysInStock: 91 });
    const fresh = buildVehicle({ id: 2, stockNumber: 'STK-0002', daysInStock: 90 });
    server.use(http.get(vehiclesUrl(1), () => HttpResponse.json(buildVehiclePage([aging, fresh]))));
    renderTable();

    const agingRow = await screen.findByRole('row', { name: /STK-0001/ });
    const freshRow = screen.getByRole('row', { name: /STK-0002/ });
    expect(within(agingRow).getByText('Aging')).toBeVisible();
    expect(within(freshRow).queryByText('Aging')).not.toBeInTheDocument();
    expect(within(freshRow).getByText('Not aging')).toHaveClass('sr-only');
    expect(within(agingRow).getByText('No action')).toBeVisible();
  });

  it('labels only the aging vehicle without an action "Needs attention", as text (AC-010.1, BR-16)', async () => {
    const neglected = buildVehicle({ id: 1, stockNumber: 'STK-0001', daysInStock: 120 });
    const handled = buildVehicle({
      id: 2,
      stockNumber: 'STK-0002',
      daysInStock: 130,
      currentAction: buildCurrentAction(),
    });
    const fresh = buildVehicle({ id: 3, stockNumber: 'STK-0003', daysInStock: 30 });
    server.use(
      http.get(vehiclesUrl(1), () =>
        HttpResponse.json(buildVehiclePage([neglected, handled, fresh])),
      ),
    );
    renderTable();

    const neglectedRow = await screen.findByRole('row', { name: /STK-0001/ });
    expect(within(neglectedRow).getByText('Needs attention')).toBeVisible();
    expect(within(neglectedRow).getByText('No action')).toBeVisible();
    expect(screen.getAllByText('Needs attention')).toHaveLength(1);
    // A fresh vehicle without an action is not aging, so it does not need attention (BR-16).
    expect(
      within(screen.getByRole('row', { name: /STK-0003/ })).getByText('No action'),
    ).toBeVisible();
  });

  it('shows the total and pages through the URL (AC-001.4)', async () => {
    const { user, router } = renderTable();

    expect(await screen.findByText('Showing 1-25 of 30')).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(26);

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Showing 26-30 of 30')).toBeVisible();
    expect(router.state.location.search).toBe('?page=2');
    expect(screen.getAllByRole('row')).toHaveLength(6);

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(await screen.findByText('Showing 1-25 of 30')).toBeVisible();
    expect(router.state.location.search).toBe('');
  });

  it('keeps the current page visible and shows "Updating…" while the next page loads', async () => {
    const { user } = renderTable();
    expect(await screen.findByText('Showing 1-25 of 30')).toBeVisible();

    server.use(http.get(vehiclesUrl(1), () => delay('infinite')));
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    // A visible hint, not a live region: the filter bar's count is the one result announcer.
    const hint = await screen.findByText('Updating…');
    expect(hint).toBeVisible();
    expect(hint).not.toHaveAttribute('aria-live');
    expect(statusTexts()).toEqual(['']);
    expect(screen.getByRole('row', { name: /STK-1001/ })).toBeVisible();
  });

  it('does not announce background refreshes (60 s polling, ADR-007)', async () => {
    const { queryClient } = renderTable();
    expect(await screen.findByText('Showing 1-25 of 30')).toBeVisible();
    const { announcements } = recordAnnouncements();

    server.use(http.get(vehiclesUrl(1), () => delay('infinite')));
    act(() => void queryClient.refetchQueries());

    await waitFor(() => expect(queryClient.isFetching()).toBe(1));
    expect(screen.queryByText('Updating…')).not.toBeInTheDocument();
    expect(statusTexts()).toEqual(['']);
    expect(announcements).toEqual([]);
  });

  it('keeps the list and shows a quiet hint when a background refresh fails', async () => {
    const { queryClient } = renderTable();
    expect(await screen.findByText('Showing 1-25 of 30')).toBeVisible();

    server.use(http.get(vehiclesUrl(1), () => HttpResponse.json(null, { status: 500 })));
    await act(() => queryClient.refetchQueries());

    expect(await screen.findByText(/couldn't refresh the list/i)).toBeVisible();
    expect(screen.getByRole('row', { name: /STK-1001/ })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(statusTexts()).toEqual(['']);
  });

  it('opens the page from the URL and replaces a page past the end with the last page (TA-05)', async () => {
    const { router } = renderTable(birmingham, '?page=9');

    expect(await screen.findByText('Showing 26-30 of 30')).toBeVisible();
    expect(router.state.location.search).toBe('?page=2');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('shows a loading state while vehicles load', async () => {
    server.use(http.get(vehiclesUrl(1), () => delay('infinite')));
    renderTable();

    await waitFor(() => expect(statusTexts()).toEqual(['', 'Loading vehicles…']));
  });

  it('shows "No vehicles in stock" for a dealership without stock (AC-001.5)', async () => {
    renderTable(york);

    // With no filters there is no match count to announce it, so the empty state is the status.
    expect(await screen.findByText('No vehicles in stock')).toBeVisible();
    expect(statusTexts()).toEqual(['', expect.stringContaining('No vehicles in stock')]);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('shows an error with Retry, then the list once loading succeeds (AC-001.6)', async () => {
    server.use(
      http.get(
        vehiclesUrl(1),
        () =>
          HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'stack trace here' } },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    const { user } = renderTable();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load vehicles");
    expect(alert).not.toHaveTextContent('stack trace here');

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('table')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  describe('in Vietnamese (US-015)', () => {
    beforeEach(async () => {
      await i18n.changeLanguage('vi');
    });

    it('translates UI text and formats, keeps vehicle data as stored (AC-015.4, AC-015.5)', async () => {
      const withAction = buildVehicle({
        id: 1,
        stockNumber: 'STK-0001',
        make: 'Ford',
        model: 'Focus',
        trim: 'Titanium',
        colour: 'Blue',
        mileage: 12345,
        listPriceMinor: 2_599_000,
        stockInDate: '2026-06-01',
        daysInStock: 128,
        currentAction: buildCurrentAction({
          status: 'Price Reduction Planned',
          loggedBy: 'Jane Smith',
          loggedAt: '2026-10-07T13:32:00.000Z',
        }),
      });
      const withoutAction = buildVehicle({ id: 2, stockNumber: 'STK-0002', daysInStock: 12 });
      server.use(
        http.get(vehiclesUrl(1), () =>
          HttpResponse.json(buildVehiclePage([withAction, withoutAction])),
        ),
      );
      renderTable();

      const table = await screen.findByRole('table', { name: 'Xe tồn kho tại Birmingham' });
      expectHeaderNames(table, [
        'Mã tồn kho',
        'Hãng xe',
        'Mẫu xe',
        'Đời xe',
        'Số ngày tồn kho',
        'Tồn kho lâu',
        'Hành động hiện tại',
        'Giá niêm yết',
        'Ngày nhập kho',
        'Số dặm đã đi',
        'Phiên bản',
        'Màu sắc',
        'Số VIN',
      ]);

      const agingRow = screen.getByRole('row', { name: /STK-0001/ });
      const cells = within(agingRow)
        .getAllByRole('cell')
        .map((cell) => cell.textContent);
      expect(cells.slice(1, 3)).toEqual(['Ford', 'Focus']);
      expect(cells[5]).toBe('Tồn kho lâu');
      expect(cells[6]).toBe('Dự kiến giảm giá' + 'Jane Smith · 07/10/2026 14:32');
      expect(cells[7]).toBe('25.990\u00a0£');
      expect(cells[8]).toBe('01/06/2026');
      expect(cells[9]).toBe('12.345 mi');
      expect(cells.slice(10, 12)).toEqual(['Titanium', 'Blue']);
      expect(within(agingRow).queryByText('Price Reduction Planned')).not.toBeInTheDocument();

      const freshRow = screen.getByRole('row', { name: /STK-0002/ });
      expect(within(freshRow).getByText('Chưa có hành động')).toBeVisible();
      expect(within(freshRow).getByText('Chưa tồn kho lâu')).toHaveClass('sr-only');
    });

    it('translates the pagination summary and buttons', async () => {
      renderTable();

      expect(await screen.findByText('Hiển thị 1-25 / 30')).toBeVisible();
      expect(screen.getByRole('navigation', { name: 'Phân trang' })).toHaveTextContent(
        'Trang 1 / 2',
      );
      expect(screen.getByRole('button', { name: 'Trang sau' })).toBeVisible();
    });

    it('translates the loading, empty and error states', async () => {
      server.use(
        http.get(vehiclesUrl(1), () => HttpResponse.json(null, { status: 500 }), { once: true }),
      );
      const { unmount } = renderTable();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Không thể tải danh sách xe');
      expect(alert).toHaveTextContent('Máy chủ đang gặp sự cố');
      expect(within(alert).getByRole('button', { name: 'Thử lại' })).toBeVisible();
      unmount();

      renderTable(york);
      expect(await screen.findByText('Không có xe tồn kho')).toBeVisible();
      expect(screen.getByText('York hiện không có xe nào trong kho.')).toBeVisible();
    });

    it('announces loading in Vietnamese', async () => {
      server.use(http.get(vehiclesUrl(1), () => delay('infinite')));
      renderTable();

      await waitFor(() => expect(statusTexts()).toEqual(['', 'Đang tải danh sách xe…']));
    });
  });
  it('adds a "View <stock number>" button per row when rows can be opened (AC-004.4)', async () => {
    const vehicle = buildVehicle({ id: 42, stockNumber: 'STK-1042' });
    server.use(http.get(vehiclesUrl(1), () => HttpResponse.json(buildVehiclePage([vehicle]))));
    const onSelectVehicle = vi.fn();
    const { user } = renderWithProviders(
      <VehicleTable dealership={birmingham} onSelectVehicle={onSelectVehicle} />,
      { route: '/dealerships/1', path: '/dealerships/:dealershipId' },
    );

    const table = await screen.findByRole('table', { name: 'Vehicles in stock at Birmingham' });
    expect(within(table).getAllByRole('columnheader')[0]).toHaveTextContent('Details');
    const view = within(table).getByRole('button', { name: 'View STK-1042' });
    expect(view).toHaveTextContent('View');

    await user.click(view);

    expect(onSelectVehicle).toHaveBeenCalledExactlyOnceWith(42);
  });

  it('names the View button in Vietnamese', async () => {
    await i18n.changeLanguage('vi');
    const vehicle = buildVehicle({ id: 42, stockNumber: 'STK-1042' });
    server.use(http.get(vehiclesUrl(1), () => HttpResponse.json(buildVehiclePage([vehicle]))));
    renderWithProviders(<VehicleTable dealership={birmingham} onSelectVehicle={vi.fn()} />, {
      route: '/dealerships/1',
      path: '/dealerships/:dealershipId',
    });

    expect(await screen.findByRole('button', { name: 'Xem STK-1042' })).toHaveTextContent('Xem');
  });

  describe('sorting (US-011, T-036)', () => {
    /** Records the main list requests (the default handler still answers). */
    function recordListRequests() {
      const requests: URLSearchParams[] = [];
      server.use(
        http.get(vehiclesUrl(1), ({ request }) => {
          requests.push(new URL(request.url).searchParams);
        }),
      );
      return requests;
    }

    const header = (name: string) => screen.getByRole('columnheader', { name });
    const sortButton = (name: string) => screen.getByRole('button', { name });
    const priceCells = () =>
      within(screen.getByRole('table'))
        .getAllByText(/^£[\d,.]+$/)
        .map((cell) => Number(cell.textContent.replace(/[^\d]/g, '')));
    /** [make, model] per body row, from the Make and Model columns (2nd and 3rd). */
    const makeModels = () =>
      within(screen.getByRole('table'))
        .getAllByRole('row')
        .slice(1)
        .filter((row) => row instanceof HTMLTableRowElement)
        .map((row) => [row.cells[1]?.textContent ?? '', row.cells[2]?.textContent ?? ''] as const);
    /** Case-insensitive, code-unit order, like the API's COLLATE NOCASE. */
    const nocase = (a: string, b: string) => {
      const [x, y] = [a.toLowerCase(), b.toLowerCase()];
      return x < y ? -1 : x > y ? 1 : 0;
    };
    const byMakeThenModel = (
      [makeA, modelA]: readonly [string, string],
      [makeB, modelB]: readonly [string, string],
    ) => nocase(makeA, makeB) || nocase(modelA, modelB);

    it('shows the default sort, days in stock descending, without announcing it (BR-17)', async () => {
      const { announcements } = recordAnnouncements();
      renderTable();
      await screen.findByText('Showing 1-25 of 30');

      expect(header('Days in stock')).toHaveAttribute('aria-sort', 'descending');
      expect(header('List price')).not.toHaveAttribute('aria-sort');
      expect(header('Make')).not.toHaveAttribute('aria-sort');
      // Only these three columns are sortable.
      expect(within(screen.getByRole('table')).getAllByRole('button')).toHaveLength(3);
      expect(announcements).toEqual([]);
    });

    it('sorts by price ascending, then toggles to descending, through the URL (AC-011.1)', async () => {
      const requests = recordListRequests();
      const { user, router } = renderTable(birmingham, '?page=2');
      await screen.findByText('Showing 26-30 of 30');

      await user.click(sortButton('List price'));

      // Ascending is price's default order (TA-06), so it stays out of the URL and the request.
      expect(router.state.location.search).toBe('?sort=price');
      expect(router.state.historyAction).toBe('PUSH');
      await waitFor(() => expect(priceCells()).toHaveLength(25));
      expect(requests.at(-1)?.get('sort')).toBe('price');
      expect(requests.at(-1)?.has('order')).toBe(false);
      expect(requests.at(-1)?.get('page')).toBe('1');
      expect(header('List price')).toHaveAttribute('aria-sort', 'ascending');
      expect(header('Days in stock')).not.toHaveAttribute('aria-sort');
      await waitFor(() => expect(priceCells()).toEqual([...priceCells()].sort((a, b) => a - b)));

      await user.click(sortButton('List price'));

      expect(router.state.location.search).toBe('?sort=price&order=desc');
      expect(requests.at(-1)?.get('order')).toBe('desc');
      expect(header('List price')).toHaveAttribute('aria-sort', 'descending');
      await waitFor(() => expect(priceCells()).toEqual([...priceCells()].sort((a, b) => b - a)));
      // Keyboard focus stays on the header button.
      expect(sortButton('List price')).toHaveFocus();
    });

    it('sorts by make and model A-Z from the Make header (AC-011.2)', async () => {
      const requests = recordListRequests();
      const { user, router } = renderTable();
      await screen.findByText('Showing 1-25 of 30');

      // The button is named by its visible label; what it sorts by is its description.
      expect(sortButton('Make')).toHaveAccessibleDescription('Sorts by make, then model');
      await user.click(sortButton('Make'));

      expect(router.state.location.search).toBe('?sort=makeModel');
      expect(requests.at(-1)?.get('sort')).toBe('makeModel');
      expect(header('Make')).toHaveAttribute('aria-sort', 'ascending');
      // The rows really are in make, then model, A-Z order.
      await waitFor(() => expect(screen.queryByText('Updating…')).not.toBeInTheDocument());
      const shown = makeModels();
      expect(shown).toHaveLength(25);
      expect(shown).toEqual([...shown].sort(byMakeThenModel));
      expect(new Set(shown.map(([make]) => make)).size).toBeGreaterThan(1);
      // Within one make, the models are ordered too (not only the makes).
      const firstMake = shown.filter(([make]) => make === shown[0]?.[0]);
      expect(new Set(firstMake.map(([, model]) => model)).size).toBeGreaterThan(1);
    });

    it('returns to the default URL when Days in stock is chosen again (TA-09)', async () => {
      const { user, router } = renderTable(birmingham, '?sort=price&order=desc');
      await screen.findByText('Showing 1-25 of 30');

      await user.click(sortButton('Days in stock'));
      expect(router.state.location.search).toBe('');
      expect(header('Days in stock')).toHaveAttribute('aria-sort', 'descending');

      await user.click(sortButton('Days in stock'));
      expect(router.state.location.search).toBe('?order=asc');
      expect(header('Days in stock')).toHaveAttribute('aria-sort', 'ascending');
    });

    it('restores the sort from the URL on reload (AC-011.3)', async () => {
      const url = '?sort=price&order=desc';
      const { unmount } = renderTable(birmingham, url);
      await screen.findByText('Showing 1-25 of 30');
      const prices = priceCells();
      unmount();

      renderTable(birmingham, url);

      await screen.findByText('Showing 1-25 of 30');
      expect(header('List price')).toHaveAttribute('aria-sort', 'descending');
      expect(priceCells()).toEqual(prices);
    });

    it('announces exactly one polite message per sort change, and the match count stays silent (AC-011.3)', async () => {
      const { user } = renderWithProviders(
        <>
          <FilterBar dealershipId={1} />
          <VehicleTable dealership={birmingham} />
        </>,
        { route: '/dealerships/1?make=Ford', path: '/dealerships/:dealershipId' },
      );
      await screen.findByText('6 vehicles match your filters');
      await screen.findByText('Showing 1-6 of 6');
      const { announcements } = recordAnnouncements();

      await user.click(sortButton('List price'));
      await waitFor(() => expect(header('List price')).toHaveAttribute('aria-sort', 'ascending'));
      await waitFor(() => expect(screen.queryByText('Updating…')).not.toBeInTheDocument());
      expect(announcements).toEqual(['Sorted by price, ascending']);

      await user.click(sortButton('List price'));
      await waitFor(() => expect(screen.queryByText('Updating…')).not.toBeInTheDocument());
      await user.click(sortButton('Make'));
      await waitFor(() => expect(screen.queryByText('Updating…')).not.toBeInTheDocument());

      expect(announcements).toEqual([
        'Sorted by price, ascending',
        'Sorted by price, descending',
        'Sorted by make and model, ascending',
      ]);
      // The count is unchanged by a sort, so it never spoke.
      expect(screen.getByText('6 vehicles match your filters')).toHaveRole('status');
    });

    it('does not repeat the sort announcement for a filter change, Back or a language switch', async () => {
      const { user, router } = renderWithProviders(
        <>
          <FilterBar dealershipId={1} />
          <VehicleTable dealership={birmingham} />
        </>,
        { route: '/dealerships/1', path: '/dealerships/:dealershipId' },
      );
      await screen.findByText('30 vehicles in stock');
      await user.click(sortButton('List price'));
      await screen.findByText('Sorted by price, ascending');
      const { announcements } = recordAnnouncements();

      await user.selectOptions(screen.getByRole('combobox', { name: 'Make' }), 'Ford');
      await screen.findByText('6 vehicles match your filters');
      await act(() => router.navigate(-1));
      await screen.findByText('30 vehicles in stock');
      await act(() => i18n.changeLanguage('vi'));
      await screen.findByText('30 xe trong kho');

      // Only the match count spoke (for the filter change); the sort status did not.
      expect(announcements.filter((text) => /sort|sắp xếp/i.test(text))).toEqual([]);
    });

    it('does not announce a sort again on Back then Forward (AC-011.3)', async () => {
      const { user, router } = renderTable();
      await screen.findByText('Showing 1-25 of 30');
      const { announcements } = recordAnnouncements();
      await user.click(sortButton('List price'));
      await waitFor(() => expect(announcements).toEqual(['Sorted by price, ascending']));

      await act(() => router.navigate(-1));
      await waitFor(() =>
        expect(header('Days in stock')).toHaveAttribute('aria-sort', 'descending'),
      );
      await act(() => router.navigate(1));
      await waitFor(() => expect(header('List price')).toHaveAttribute('aria-sort', 'ascending'));
      await waitFor(() => expect(screen.queryByText('Updating…')).not.toBeInTheDocument());

      expect(announcements).toEqual(['Sorted by price, ascending']);
      expect(statusTexts()).toEqual(['']);
    });

    it('announces a fresh sort click after Back once (AC-011.3)', async () => {
      const { user, router } = renderTable();
      await screen.findByText('Showing 1-25 of 30');
      await user.click(sortButton('List price'));
      await screen.findByText('Sorted by price, ascending');
      await act(() => router.navigate(-1));
      await waitFor(() =>
        expect(header('Days in stock')).toHaveAttribute('aria-sort', 'descending'),
      );
      const { announcements } = recordAnnouncements();

      await user.click(sortButton('List price'));

      await waitFor(() => expect(header('List price')).toHaveAttribute('aria-sort', 'ascending'));
      await waitFor(() => expect(screen.queryByText('Updating…')).not.toBeInTheDocument());
      expect(announcements).toEqual(['Sorted by price, ascending']);
    });

    it('announces the sort in Vietnamese (BR-19)', async () => {
      await i18n.changeLanguage('vi');
      const requests = recordListRequests();
      const { user } = renderTable();
      await screen.findByText('Hiển thị 1-25 / 30');
      const { announcements } = recordAnnouncements();

      await user.click(screen.getByRole('button', { name: 'Giá niêm yết' }));

      await waitFor(() => expect(announcements).toEqual(['Đã sắp xếp theo giá, tăng dần']));
      // Same request as in English: the language never reaches the API.
      expect(requests.at(-1)?.toString()).toBe('sort=price&page=1&pageSize=25');

      await user.click(screen.getByRole('button', { name: 'Số ngày tồn kho' }));
      await waitFor(() =>
        expect(announcements.at(-1)).toBe('Đã sắp xếp theo số ngày tồn kho, giảm dần'),
      );
      const make = screen.getByRole('button', { name: 'Hãng xe' });
      expect(make).toHaveAccessibleDescription('Sắp xếp theo hãng xe, rồi theo mẫu xe');
      await user.click(make);
      await waitFor(() =>
        expect(announcements.at(-1)).toBe('Đã sắp xếp theo hãng xe và mẫu xe, tăng dần'),
      );
      expect(announcements).toHaveLength(3);
    });
  });

  describe('structure and paging announcements (T-038)', () => {
    /** The visible (not live) summary; the match count may hold the same words, visually hidden. */
    const pagingSummary = async (text: string) =>
      within(await screen.findByRole('navigation', { name: 'Pagination' })).findByText(text);

    function renderWithFilters(search = '') {
      return renderWithProviders(
        <>
          <FilterBar dealershipId={1} />
          <VehicleTable dealership={birmingham} />
        </>,
        { route: `/dealerships/1${search}`, path: '/dealerships/:dealershipId' },
      );
    }

    it('is one "Vehicle list" region named by its h2, with a focusable scroll group inside, not a nested region', async () => {
      renderTable();
      const table = await screen.findByRole('table', { name: 'Vehicles in stock at Birmingham' });

      const regions = screen.getAllByRole('region');
      expect(regions).toHaveLength(1);
      const [region] = regions;
      expect(region).toHaveAccessibleName('Vehicle list');
      const heading = within(region as HTMLElement).getByRole('heading', {
        level: 2,
        name: 'Vehicle list',
      });
      // Programmatic focus target only (View all, drawer fallback); not a Tab stop.
      expect(heading).toHaveAttribute('tabindex', '-1');
      const scroller = screen.getByRole('group', { name: 'Vehicles in stock at Birmingham' });
      expect(scroller).toContainElement(table);
      expect(scroller).toHaveAttribute('tabindex', '0');
    });

    it('announces the new range once per page change, keeping focus on the paging button', async () => {
      const { user } = renderWithFilters();
      await pagingSummary('Showing 1-25 of 30');
      const { announcements } = recordAnnouncements();

      const next = screen.getByRole('button', { name: 'Next page' });
      await user.click(next);
      await pagingSummary('Showing 26-30 of 30');
      await waitFor(() => expect(announcements).toHaveLength(1));
      expect(announcements).toEqual(['30 vehicles in stock Showing 26-30 of 30']);
      expect(next).toHaveFocus();

      await user.click(screen.getByRole('button', { name: 'Previous page' }));
      await pagingSummary('Showing 1-25 of 30');
      await waitFor(() => expect(announcements).toHaveLength(2));
      expect(announcements[1]).toBe('30 vehicles in stock Showing 1-25 of 30');
      // The visible count is unchanged; the range is for screen readers only.
      expect(screen.getByText('Showing 1-25 of 30', { selector: '.sr-only' })).toBeInTheDocument();
    });

    it('does not announce the range for a poll of the same page, nor for a filter or sort change', async () => {
      const { user, queryClient } = renderWithFilters('?page=2');
      await pagingSummary('Showing 26-30 of 30');
      const { announcements } = recordAnnouncements();

      await act(() => queryClient.refetchQueries());
      expect(announcements).toEqual([]);

      await user.click(screen.getByRole('button', { name: 'List price' }));
      await pagingSummary('Showing 1-25 of 30');
      await user.selectOptions(screen.getByRole('combobox', { name: 'Make' }), 'Ford');
      await screen.findByText('6 vehicles match your filters');

      expect(announcements).toEqual([
        'Sorted by price, ascending',
        '6 vehicles match your filters',
      ]);
    });
  });

  it('toggles to descending on a second header click made before the re-render (Phase 6 bug)', async () => {
    const { router } = renderTable();
    const price = await screen.findByRole('button', { name: 'List price' });

    // Two clicks in one tick: the second must toggle the first one's sort, not the rendered one.
    // eslint-disable-next-line testing-library/no-unnecessary-act -- the outer act keeps both clicks in one tick (nested acts do not flush), so React cannot re-render in between
    act(() => {
      fireEvent.click(price);
      fireEvent.click(price);
    });

    expect(router.state.location.search).toBe('?sort=price&order=desc');
    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: 'List price' })).toHaveAttribute(
        'aria-sort',
        'descending',
      ),
    );
  });
});
