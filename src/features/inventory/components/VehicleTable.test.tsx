import { act, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { VehicleTable } from '@/features/inventory';
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

function renderTable(dealership = birmingham, search = '') {
  return renderWithProviders(<VehicleTable dealership={dealership} />, {
    route: `/dealerships/${dealership.id}${search}`,
    path: '/dealerships/:dealershipId',
  });
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
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(COLUMNS);
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
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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

    expect(await screen.findByRole('status')).toHaveTextContent('Loading vehicles…');
  });

  it('shows "No vehicles in stock" for a dealership without stock (AC-001.5)', async () => {
    renderTable(york);

    // With no filters there is no match count to announce it, so the empty state is the status.
    expect(await screen.findByText('No vehicles in stock')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('No vehicles in stock');
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
      expect(
        within(table)
          .getAllByRole('columnheader')
          .map((th) => th.textContent),
      ).toEqual([
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

      expect(await screen.findByRole('status')).toHaveTextContent('Đang tải danh sách xe…');
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
});
