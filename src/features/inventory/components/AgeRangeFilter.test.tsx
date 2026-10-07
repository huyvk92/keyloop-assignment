import { screen, waitFor, within } from '@testing-library/react';
import { VehicleListQuerySchema } from '@shared/api/vehicles';
import { delay, http, HttpResponse } from 'msw';
import { FilterBar, VehicleTable } from '@/features/inventory';
import { i18n } from '@/i18n';
import { apiUrl } from '@/lib/http';
import { buildDealership, buildVehicle, buildVehiclePage } from '@/mocks/fixtures';
import { server } from '@/mocks/server';
import { queryVehicles } from '@/mocks/vehicle-query';
import { recordAnnouncements } from '@/test/announcements';
import { renderWithProviders } from '@/test/render';

const birmingham = buildDealership({ id: 1, name: 'Birmingham' });
const vehiclesPattern = apiUrl('/dealerships/:dealershipId/vehicles');

function recordListRequests() {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get(vehiclesPattern, ({ request }) => {
      requests.push(new URL(request.url).searchParams);
    }),
  );
  return requests;
}

/** The dashboard's filter + list composition, without the page chrome. */
function renderDashboard(search = '') {
  return renderWithProviders(
    <>
      <FilterBar dealershipId={1} />
      <VehicleTable dealership={birmingham} />
    </>,
    { route: `/dealerships/1${search}`, path: '/dealerships/:dealershipId' },
  );
}

const minInput = () => screen.getByRole('textbox', { name: 'Minimum days' });
const maxInput = () => screen.getByRole('textbox', { name: 'Maximum days' });
const apply = () => screen.getByRole('button', { name: 'Apply range' });

describe('AgeRangeFilter', () => {
  it('applies 45-90 as both params, inclusive (AC-002.4)', async () => {
    const requests = recordListRequests();
    const { user, router } = renderDashboard('?page=2');
    await screen.findByText('Showing 26-30 of 30');

    await user.type(minInput(), '45');
    await user.type(maxInput(), '90');
    await user.click(apply());

    // Ages 200..26 in steps of 6: 50, 56, ..., 86 are within 45-90.
    expect(await screen.findByText('7 vehicles match your filters')).toBeVisible();
    expect(router.state.location.search).toBe('?minAge=45&maxAge=90');
    expect(requests.at(-1)?.get('minAge')).toBe('45');
    expect(requests.at(-1)?.get('maxAge')).toBe('90');
    const days = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => Number(within(row).getAllByRole('cell')[4]?.textContent));
    expect(days.every((d) => d >= 45 && d <= 90)).toBe(true);
  });

  it('includes vehicles exactly at 45 and 90 days and excludes 44 and 91 (AC-002.4)', async () => {
    const stock = [44, 45, 90, 91].map((daysInStock) =>
      buildVehicle({ id: daysInStock, stockNumber: `STK-00${daysInStock}`, daysInStock }),
    );
    server.use(
      http.get(vehiclesPattern, ({ request }) => {
        const query = VehicleListQuerySchema.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        );
        return HttpResponse.json(buildVehiclePage(queryVehicles(stock, query), query));
      }),
    );
    const { user } = renderDashboard();
    await screen.findByText('4 vehicles in stock');

    await user.type(minInput(), '45');
    await user.type(maxInput(), '90');
    await user.click(apply());

    expect(await screen.findByText('2 vehicles match your filters')).toBeVisible();
    expect(screen.getByRole('row', { name: /STK-0045/ })).toBeVisible();
    expect(screen.getByRole('row', { name: /STK-0090/ })).toBeVisible();
    expect(screen.queryByRole('row', { name: /STK-0044/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /STK-0091/ })).not.toBeInTheDocument();
  });

  it('does nothing when the applied range is applied again unchanged', async () => {
    const requests = recordListRequests();
    const { user, router } = renderDashboard('?minAge=45&maxAge=90');
    await screen.findByText('7 vehicles match your filters');
    const before = requests.length;
    const entry = router.state.location.key;

    await user.click(apply());

    expect(router.state.location.key).toBe(entry);
    expect(requests).toHaveLength(before);
  });

  it('shows an inline error linked to the input for 100/50 and sends no request (AC-002.4, BR-07)', async () => {
    const requests = recordListRequests();
    const { user, router } = renderDashboard();
    await screen.findByText('30 vehicles in stock');
    const before = requests.length;

    await user.type(minInput(), '100');
    await user.type(maxInput(), '50');
    await user.click(apply());

    const message = 'Minimum days must be less than or equal to maximum days.';
    expect(await screen.findByText(message)).toBeVisible();
    expect(maxInput()).toHaveAttribute('aria-invalid', 'true');
    expect(maxInput()).toHaveAccessibleDescription(message);
    expect(maxInput()).toHaveFocus();
    // The contract's English message is never shown raw.
    expect(screen.queryByText(/less than or equal to maximum age/)).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    expect(requests).toHaveLength(before);

    await user.clear(maxInput());
    await user.type(maxInput(), '150');
    await user.click(apply());
    expect(await screen.findByText('8 vehicles match your filters')).toBeVisible();
    expect(maxInput()).not.toHaveAttribute('aria-invalid');
  });

  it('rejects a value that is not a whole number of days', async () => {
    const { user, router } = renderDashboard();

    await user.type(minInput(), '4.5');
    await user.click(apply());

    expect(await screen.findByText('Enter a whole number of days from 0 to 36,500.')).toBeVisible();
    expect(minInput()).toHaveAttribute('aria-invalid', 'true');
    expect(router.state.location.search).toBe('');
  });

  it('treats an emptied input as "no bound" and removes it from the URL', async () => {
    const { user, router } = renderDashboard('?minAge=45&maxAge=90');
    expect(minInput()).toHaveValue('45');

    await user.clear(maxInput());
    await user.click(apply());

    expect(router.state.location.search).toBe('?minAge=45');
    expect(await screen.findByText('26 vehicles match your filters')).toBeVisible();
  });

  it('shows the error in Vietnamese', async () => {
    await i18n.changeLanguage('vi');
    const { user } = renderDashboard();

    await user.type(screen.getByRole('textbox', { name: 'Số ngày tối thiểu' }), '100');
    await user.type(screen.getByRole('textbox', { name: 'Số ngày tối đa' }), '50');
    await user.click(screen.getByRole('button', { name: 'Áp dụng khoảng' }));

    expect(
      await screen.findByText('Số ngày tối thiểu phải nhỏ hơn hoặc bằng số ngày tối đa.'),
    ).toBeVisible();
  });
});

describe('No vehicles match your filters (AC-002.8)', () => {
  it('shows the message and Clear filters, which resets the URL and shows rows again', async () => {
    const { user, router } = renderDashboard('?make=Ford&model=Focus&ageBucket=31-60&sort=price');

    expect(await screen.findByText('No vehicles match your filters')).toBeVisible();
    expect(screen.queryByText('No vehicles in stock')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(router.state.location.pathname).toBe('/dealerships/1');
    expect(router.state.location.search).toBe('?sort=price');
    expect(screen.getByRole('search', { name: 'Filter vehicles' })).toHaveFocus();
    expect(await screen.findByRole('table')).toBeVisible();
    expect(screen.getByText('30 vehicles in stock')).toBeVisible();
    // The controls follow the URL.
    expect(screen.getByRole('combobox', { name: 'Make' })).toHaveDisplayValue('All makes');
    expect(screen.getByRole('combobox', { name: 'Days in stock' })).toHaveDisplayValue('Any age');
  });

  it('clears the custom range and the search box too', async () => {
    const { user } = renderDashboard('?minAge=300&q=zzz');

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(minInput()).toHaveValue(''));
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
    expect(await screen.findByText('30 vehicles in stock')).toBeVisible();
  });

  it('shows loading, never "No vehicles in stock", while the cleared list loads', async () => {
    const { user } = renderDashboard('?q=zzz');
    await screen.findByText('No vehicles match your filters');
    server.use(http.get(vehiclesPattern, () => delay('infinite')));

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Loading vehicles…')).toBeInTheDocument();
    expect(screen.queryByText('No vehicles in stock')).not.toBeInTheDocument();
    expect(screen.queryByText('No vehicles match your filters')).not.toBeInTheDocument();
  });

  it('discards an unapplied range draft and its error (AC-002.8)', async () => {
    const { user, router } = renderDashboard('?q=zzz');
    await screen.findByText('No vehicles match your filters');
    await user.type(minInput(), '100');
    await user.type(maxInput(), '50');
    await user.click(apply());
    const message = 'Minimum days must be less than or equal to maximum days.';
    expect(await screen.findByText(message)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(router.state.location.search).toBe('');
    expect(await screen.findByText('30 vehicles in stock')).toBeVisible();
    expect(minInput()).toHaveValue('');
    expect(maxInput()).toHaveValue('');
    expect(maxInput()).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it('discards a valid but unapplied range draft too', async () => {
    const { user } = renderDashboard('?make=Ford&model=Focus&ageBucket=31-60');
    await screen.findByText('No vehicles match your filters');
    await user.type(minInput(), '10');
    await user.type(maxInput(), '20');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('30 vehicles in stock')).toBeVisible();
    expect(minInput()).toHaveValue('');
    expect(maxInput()).toHaveValue('');
  });

  it('announces the result once: the count is the only live update (AC-002.1)', async () => {
    const { user } = renderDashboard('?page=2');
    await screen.findByText('Showing 26-30 of 30');
    const { announcements } = recordAnnouncements();

    await user.type(minInput(), '300');
    await user.click(apply());

    expect(await screen.findByText('No vehicles match your filters')).toBeVisible();
    // The empty state is not a second status region; the count announces the outcome.
    expect(screen.getAllByRole('status').map((status) => status.textContent)).toEqual([
      '0 vehicles match your filters',
    ]);
    expect(announcements).toEqual(['0 vehicles match your filters']);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await screen.findByText('Showing 1-25 of 30');
    expect(announcements).toEqual(['0 vehicles match your filters', '30 vehicles in stock']);
  });

  it('is translated in Vietnamese', async () => {
    await i18n.changeLanguage('vi');
    renderDashboard('?q=zzz');

    expect(await screen.findByText('Không có xe nào khớp với bộ lọc')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Xóa bộ lọc' })).toBeVisible();
  });
});
