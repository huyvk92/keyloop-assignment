import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { FilterBar } from '@/features/inventory';
import { i18n } from '@/i18n';
import { apiUrl } from '@/lib/http';
import { buildVehicle, buildVehiclePage } from '@/mocks/fixtures';
import { server } from '@/mocks/server';
import { recordAnnouncements } from '@/test/announcements';
import { startManualClock, stopManualClock } from '@/test/manual-clock';
import { renderWithProviders } from '@/test/render';

const vehiclesPattern = apiUrl('/dealerships/:dealershipId/vehicles');

/** Records every list request (the default handler still answers). */
function recordListRequests() {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get(vehiclesPattern, ({ request }) => {
      requests.push(new URL(request.url).searchParams);
    }),
  );
  return requests;
}

function renderFilterBar(search = '') {
  return renderWithProviders(<FilterBar dealershipId={1} />, {
    route: `/dealerships/1${search}`,
    path: '/dealerships/:dealershipId',
  });
}

const optionsOf = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((option) => option.textContent);

describe('FilterBar', () => {
  it('is a labelled search region with a named control for every filter (NFR-01)', async () => {
    renderFilterBar();

    const region = screen.getByRole('search', { name: 'Filter vehicles' });
    expect(within(region).getByRole('searchbox', { name: 'Search' })).toHaveAccessibleDescription(
      'VIN, stock number or model',
    );
    expect(within(region).getByRole('combobox', { name: 'Make' })).toBeVisible();
    expect(within(region).getByRole('combobox', { name: 'Model' })).toBeVisible();
    expect(within(region).getByRole('combobox', { name: 'Days in stock' })).toBeVisible();
    expect(
      within(region).getByRole('checkbox', { name: 'Aging only (over 90 days)' }),
    ).not.toBeChecked();
    expect(within(region).getByRole('group', { name: 'Custom age range (days)' })).toBeVisible();
    expect(await within(region).findByText('30 vehicles in stock')).toHaveRole('status');
  });

  it('filters by make: sends make=Ford and the count updates (AC-002.1)', async () => {
    const requests = recordListRequests();
    const { user, router } = renderFilterBar();
    const make = screen.getByRole('combobox', { name: 'Make' });
    await waitFor(() => expect(optionsOf(make)).toContain('Ford'));

    await user.selectOptions(make, 'Ford');

    expect(await screen.findByText('6 vehicles match your filters')).toHaveRole('status');
    expect(router.state.location.search).toBe('?make=Ford');
    expect(requests.at(-1)?.get('make')).toBe('Ford');
  });

  it('offers every model with no make, only the make models with one, and clears an incompatible model (BR-06, AC-002.2)', async () => {
    const { user, router } = renderFilterBar();
    const make = screen.getByRole('combobox', { name: 'Make' });
    const model = screen.getByRole('combobox', { name: 'Model' });
    await waitFor(() => expect(optionsOf(make)).toHaveLength(6));
    expect(optionsOf(make)).toEqual(['All makes', 'Audi', 'BMW', 'Ford', 'Toyota', 'Volkswagen']);
    expect(optionsOf(model)).toEqual([
      'All models',
      '3 Series',
      'A3',
      'Corolla',
      'Fiesta',
      'Focus',
      'Golf',
      'Polo',
      'Q3',
      'X1',
      'Yaris',
    ]);

    await user.selectOptions(make, 'Ford');
    expect(optionsOf(model)).toEqual(['All models', 'Fiesta', 'Focus']);
    await user.selectOptions(model, 'Focus');
    expect(router.state.location.search).toBe('?make=Ford&model=Focus');
    expect(await screen.findByText('3 vehicles match your filters')).toHaveRole('status');

    await user.selectOptions(make, 'Toyota');

    expect(router.state.location.search).toBe('?make=Toyota');
    expect(model).toHaveDisplayValue('All models');
    expect(optionsOf(model)).toEqual(['All models', 'Corolla', 'Yaris']);
  });

  it('combines make and the over-90 bucket with AND (AC-002.3, AC-002.5)', async () => {
    const requests = recordListRequests();
    const { user, router } = renderFilterBar('?make=Ford');
    await screen.findByText('6 vehicles match your filters');

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Days in stock' }),
      'Over 90 days',
    );

    // Ford ids 5,10,15,20,25 and 30 are aged 176,146,116,86,56,26: three are over 90.
    expect(await screen.findByText('3 vehicles match your filters')).toHaveRole('status');
    expect(router.state.location.search).toBe('?make=Ford&ageBucket=over-90');
    expect(requests.at(-1)?.get('ageBucket')).toBe('over-90');
    expect(requests.at(-1)?.get('make')).toBe('Ford');
  });

  it('toggles aging only in the URL; unchecking removes it (AC-004.3, TA-27)', async () => {
    const requests = recordListRequests();
    const { user, router } = renderFilterBar('?page=2');
    await screen.findByText('30 vehicles in stock');
    const agingOnly = screen.getByRole('checkbox', { name: 'Aging only (over 90 days)' });

    await user.click(agingOnly);

    expect(router.state.location.search).toBe('?agingOnly=true');
    // Ages 200..26 in steps of 6: 19 vehicles are over 90 days.
    expect(await screen.findByText('19 vehicles match your filters')).toHaveRole('status');
    expect(requests.at(-1)?.get('agingOnly')).toBe('true');

    await user.click(agingOnly);
    expect(router.state.location.search).toBe('');
    expect(agingOnly).not.toBeChecked();
  });

  it('toggles "Needs attention only" in the URL, combined with other filters (AC-010.1, BR-16)', async () => {
    const requests = recordListRequests();
    const { user, router } = renderFilterBar('?make=Ford&page=2');
    await screen.findByText('6 vehicles match your filters');
    const toggle = screen.getByRole('checkbox', { name: 'Needs attention only' });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    // Combines with make (AND, BR-05); a filter change returns to page 1 and pushes.
    expect(router.state.location.search).toBe('?make=Ford&needsAttention=true');
    expect(router.state.historyAction).toBe('PUSH');
    // Ford: 3 aging, 1 of them with an action (fixtures), so 2 need attention.
    expect(await screen.findByText('2 vehicles match your filters')).toHaveRole('status');
    expect(requests.at(-1)?.get('needsAttention')).toBe('true');
    expect(requests.at(-1)?.get('make')).toBe('Ford');
    expect(toggle).toBeChecked();

    // Unchecked means "no restriction" and leaves the URL (TA-27).
    await user.click(toggle);
    expect(router.state.location.search).toBe('?make=Ford');
    expect(toggle).not.toBeChecked();
  });

  it('restores "Needs attention only" from the URL on reload', async () => {
    renderFilterBar('?needsAttention=true');

    expect(screen.getByRole('checkbox', { name: 'Needs attention only' })).toBeChecked();
    expect(await screen.findByText('12 vehicles match your filters')).toBeVisible();
  });

  describe('search (fake timers)', () => {
    afterEach(stopManualClock);

    it('sends one debounced, trimmed request 300 ms after typing " stk-102 " (AC-002.6, TA-08)', async () => {
      const requests = recordListRequests();
      const { router } = renderFilterBar();
      await screen.findByText('30 vehicles in stock');
      // From here the only clock movement before the commit is the explicit 299 + 1 ms below;
      // `delay: null` makes user-event itself use no timers.
      startManualClock();
      const user = userEvent.setup({ delay: null });
      const searchbox = screen.getByRole('searchbox', { name: 'Search' });

      await user.type(searchbox, ' stk-102 ');
      await act(() => vi.advanceTimersByTimeAsync(299));
      expect(router.state.location.search).toBe('');
      expect(requests.filter((params) => params.has('q'))).toHaveLength(0);

      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(router.state.location.search).toBe('?q=stk-102');

      expect(await screen.findByText('10 vehicles match your filters')).toHaveRole('status');
      expect(requests.filter((params) => params.has('q')).map((params) => params.get('q'))).toEqual(
        ['stk-102'],
      );
      // The user's own spacing stays in the box.
      expect(searchbox).toHaveValue(' stk-102 ');
    });
  });

  it('keeps one history entry per search: Back leaves the search in one step (TA-28)', async () => {
    const { user, router } = renderFilterBar('?make=Ford');
    await screen.findByText('6 vehicles match your filters');
    const searchbox = screen.getByRole('searchbox', { name: 'Search' });

    await user.type(searchbox, 'stk');
    await waitFor(() => expect(router.state.location.search).toBe('?make=Ford&q=stk'));
    expect(router.state.historyAction).toBe('PUSH');
    await user.type(searchbox, '-10');
    await waitFor(() => expect(router.state.location.search).toBe('?make=Ford&q=stk-10'));
    expect(router.state.historyAction).toBe('REPLACE');

    await act(() => router.navigate(-1));

    expect(router.state.location.search).toBe('?make=Ford');
    expect(searchbox).toHaveValue('');
  });

  it('pushes a history entry when the search is cleared (TA-28)', async () => {
    const { user, router } = renderFilterBar('?q=stk');
    await screen.findByText(/your filters/);

    await user.clear(screen.getByRole('searchbox', { name: 'Search' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(router.state.historyAction).toBe('PUSH');
  });

  it('announces the count once per settled result, not while the next one loads', async () => {
    const { user } = renderFilterBar();
    const status = await screen.findByRole('status');
    await waitFor(() => expect(status).toHaveTextContent('30 vehicles in stock'));
    const { announcements } = recordAnnouncements();
    server.use(http.get(vehiclesPattern, () => delay('infinite')));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Days in stock' }), '0-30 days');

    // The previous text stays (no premature "30 vehicles match your filters").
    expect(status).toHaveTextContent('30 vehicles in stock');
    expect(announcements).toEqual([]);
  });

  it('announces one polite message per filter change (AC-002.1)', async () => {
    const { user } = renderFilterBar();
    await screen.findByText('30 vehicles in stock');
    const { announcements } = recordAnnouncements();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Make' }), 'Ford');
    await screen.findByText('6 vehicles match your filters');
    await user.click(screen.getByRole('checkbox', { name: 'Aging only (over 90 days)' }));
    await screen.findByText('3 vehicles match your filters');

    expect(announcements).toEqual([
      '6 vehicles match your filters',
      '3 vehicles match your filters',
    ]);
  });

  it('updates the count silently after a background refresh (60 s polling, ADR-007)', async () => {
    const { queryClient } = renderFilterBar();
    await screen.findByText('30 vehicles in stock');
    const { announcements } = recordAnnouncements();
    server.use(
      http.get(vehiclesPattern, () =>
        HttpResponse.json(buildVehiclePage([buildVehicle({ id: 1 }), buildVehicle({ id: 2 })])),
      ),
    );

    await act(() => queryClient.refetchQueries());

    expect(await screen.findByText('2 vehicles in stock')).toHaveRole('status');
    expect(announcements).toEqual([]);
  });

  it('resets single filters with "All makes", "All models" and "Any age"', async () => {
    const requests = recordListRequests();
    const { user, router } = renderFilterBar('?make=Ford&model=Focus&ageBucket=over-90');
    await screen.findByText(/your filters/);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Model' }), 'All models');
    expect(router.state.location.search).toBe('?make=Ford&ageBucket=over-90');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Days in stock' }), 'Any age');
    expect(router.state.location.search).toBe('?make=Ford');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Make' }), 'All makes');
    expect(router.state.location.search).toBe('');

    expect(await screen.findByText('30 vehicles in stock')).toHaveRole('status');
    const last = requests.at(-1);
    expect(last && ['make', 'model', 'ageBucket'].some((key) => last.has(key))).toBe(false);
  });

  it('restores every control from the URL on reload (AC-002.7)', async () => {
    renderFilterBar(
      '?make=Ford&model=Focus&ageBucket=over-90&minAge=45&maxAge=200&agingOnly=true&q=stk',
    );

    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('stk');
    expect(screen.getByRole('combobox', { name: 'Make' })).toHaveDisplayValue('Ford');
    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveDisplayValue('Focus');
    expect(screen.getByRole('combobox', { name: 'Days in stock' })).toHaveDisplayValue(
      'Over 90 days',
    );
    expect(screen.getByRole('checkbox', { name: 'Aging only (over 90 days)' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Minimum days' })).toHaveValue('45');
    expect(screen.getByRole('textbox', { name: 'Maximum days' })).toHaveValue('200');
    expect(await screen.findByText('1 vehicle matches your filters')).toHaveRole('status');
  });

  it('shows the make/model options error with Retry; the other filters keep working', async () => {
    server.use(
      http.get(
        apiUrl('/dealerships/:dealershipId/facets'),
        () => HttpResponse.json(null, { status: 500 }),
        {
          once: true,
        },
      ),
    );
    const { user } = renderFilterBar('?make=Ford');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load the make and model options.");
    expect(screen.getByRole('combobox', { name: 'Make' })).toHaveDisplayValue('Ford');

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(optionsOf(screen.getByRole('combobox', { name: 'Make' }))).toContain('Toyota');
  });

  it('is translated in Vietnamese; make and model stay as stored (BR-19)', async () => {
    await i18n.changeLanguage('vi');
    renderFilterBar('?make=Ford');

    const region = screen.getByRole('search', { name: 'Lọc xe' });
    expect(within(region).getByRole('searchbox', { name: 'Tìm kiếm' })).toBeVisible();
    expect(within(region).getByRole('combobox', { name: 'Hãng xe' })).toHaveDisplayValue('Ford');
    expect(within(region).getByRole('combobox', { name: 'Số ngày tồn kho' })).toHaveDisplayValue(
      'Tất cả',
    );
    expect(
      within(region).getByRole('checkbox', { name: 'Chỉ xe tồn kho lâu (trên 90 ngày)' }),
    ).toBeVisible();
    expect(within(region).getByRole('checkbox', { name: 'Chỉ xe cần xử lý' })).toBeVisible();
    expect(await within(region).findByText('6 xe khớp với bộ lọc')).toHaveRole('status');
  });

  it('sends the same params when used in Vietnamese as in English (BR-19)', async () => {
    const requests = recordListRequests();
    await i18n.changeLanguage('vi');
    const { user, router } = renderFilterBar();
    const make = screen.getByRole('combobox', { name: 'Hãng xe' });
    await waitFor(() => expect(optionsOf(make)).toContain('Ford'));

    await user.selectOptions(make, 'Ford');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Số ngày tồn kho' }),
      'Trên 90 ngày',
    );

    expect(await screen.findByText('3 xe khớp với bộ lọc')).toHaveRole('status');
    expect(router.state.location.search).toBe('?make=Ford&ageBucket=over-90');
    expect(Object.fromEntries(requests.at(-1) ?? [])).toMatchObject({
      make: 'Ford',
      ageBucket: 'over-90',
    });
  });
});
