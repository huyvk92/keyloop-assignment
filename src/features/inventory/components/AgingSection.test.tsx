import { act, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { useParams } from 'react-router';
import userEvent from '@testing-library/user-event';
import { AgingSection, FilterBar, VehicleTable } from '@/features/inventory';
import { i18n } from '@/i18n';
import { apiUrl } from '@/lib/http';
import {
  buildCurrentAction,
  buildDealership,
  buildVehicle,
  buildVehiclePage,
} from '@/mocks/fixtures';
import { server } from '@/mocks/server';
import { startManualClock, stopManualClock } from '@/test/manual-clock';
import { renderWithProviders } from '@/test/render';
import { SEARCH_DEBOUNCE_MS } from '../hooks/useSearchDraft';

const birmingham = buildDealership({ id: 1, name: 'Birmingham' });
const vehiclesUrl = apiUrl('/dealerships/:dealershipId/vehicles');
const AGING_SEARCH = '?agingOnly=true&sort=age&order=desc&pageSize=10';

/** The section's request (TA-11), matched on its full search string like DashboardPage.test. */
const isAgingRequest = (request: Request) => new URL(request.url).search === AGING_SEARCH;

/** Three aging vehicles in the API's order (oldest first, BR-17). */
const threeAging = [
  buildVehicle({
    id: 7,
    stockNumber: 'STK-0007',
    make: 'Ford',
    model: 'Focus',
    daysInStock: 200,
    currentAction: buildCurrentAction({ status: 'Price Reduction Planned' }),
  }),
  buildVehicle({
    id: 8,
    stockNumber: 'STK-0008',
    make: 'Toyota',
    model: 'Yaris',
    daysInStock: 150,
    currentAction: null,
  }),
  buildVehicle({
    id: 9,
    stockNumber: 'STK-0009',
    make: 'Kia',
    model: 'Ceed',
    daysInStock: 95,
    currentAction: buildCurrentAction({ status: 'Marketing Promotion' }),
  }),
];

/** Answers the aging request with `respond()`; the list's requests fall through to the default mock. */
function mockAging(respond: () => Response | Promise<Response>) {
  server.use(
    http.get(vehiclesUrl, ({ request }) => (isAgingRequest(request) ? respond() : undefined)),
  );
}

/** The section reads its dealership from the path, like the page, so a switch can be tested. */
function Harness({ onSelectVehicle }: { onSelectVehicle?: (id: number) => void }) {
  const dealershipId = Number(useParams().dealershipId);
  return <AgingSection dealershipId={dealershipId} onSelectVehicle={onSelectVehicle} />;
}

function renderSection(
  { route = '/dealerships/1' }: { route?: string } = {},
  onSelectVehicle?: (id: number) => void,
) {
  return renderWithProviders(
    <>
      <Harness onSelectVehicle={onSelectVehicle} />
      <VehicleTable dealership={birmingham} />
    </>,
    { route, path: '/dealerships/:dealershipId' },
  );
}

const section = () => screen.getByRole('region', { name: 'Aging stock' });

describe('AgingSection', () => {
  it('requests the 10 oldest aging vehicles of the dealership, without any filter (AC-004.1, TA-11)', async () => {
    const requests: URL[] = [];
    server.use(
      http.get(vehiclesUrl, ({ request }) => {
        if (isAgingRequest(request)) requests.push(new URL(request.url));
      }),
    );
    renderSection({ route: '/dealerships/1?make=Ford&page=2' });

    await screen.findByRole('list', { name: 'Aging vehicles, oldest first' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.pathname).toBe(new URL(apiUrl('/dealerships/1/vehicles')).pathname);
    // Exactly these params: the list's filters and page don't leak into the section.
    expect(requests[0]?.search).toBe(AGING_SEARCH);
  });

  it('lists aging vehicles oldest first with age and current action (AC-004.1, BR-14, BR-17)', async () => {
    mockAging(() => HttpResponse.json(buildVehiclePage(threeAging, { pageSize: 10 })));
    renderSection();

    const list = await screen.findByRole('list', { name: 'Aging vehicles, oldest first' });
    expect(within(section()).getByRole('heading', { level: 2, name: 'Aging stock' })).toBeVisible();
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'STK-0007Ford Focus200 daysPrice Reduction Planned',
      'STK-0008Toyota Yaris150 daysNo actionNeeds attention',
      'STK-0009Kia Ceed95 daysMarketing Promotion',
    ]);
    expect(
      within(section()).getByRole('button', { name: 'View all 3 aging vehicles' }),
    ).toBeVisible();
    // Items are not buttons unless a handler is given.
    expect(within(list).queryByRole('button')).not.toBeInTheDocument();
  });

  it('labels only the vehicle without an action "Needs attention", as text (AC-010.1, BR-16)', async () => {
    mockAging(() => HttpResponse.json(buildVehiclePage(threeAging, { pageSize: 10 })));
    renderSection();

    const list = await screen.findByRole('list', { name: 'Aging vehicles, oldest first' });
    const [withAction, withoutAction, withOtherAction] = within(list).getAllByRole('listitem');
    if (!withAction || !withoutAction || !withOtherAction) throw new Error('expected 3 items');
    expect(within(withoutAction).getByText('Needs attention')).toBeVisible();
    expect(within(withAction).queryByText('Needs attention')).not.toBeInTheDocument();
    expect(within(withOtherAction).queryByText('Needs attention')).not.toBeInTheDocument();
  });

  it('pluralises the View all label for a single aging vehicle', async () => {
    mockAging(() => HttpResponse.json(buildVehiclePage(threeAging.slice(0, 1), { pageSize: 10 })));
    renderSection();

    expect(await screen.findByRole('button', { name: 'View 1 aging vehicle' })).toBeVisible();
  });

  it('shows "No aging stock" when the dealership has no aging vehicles (AC-004.2)', async () => {
    mockAging(() => HttpResponse.json(buildVehiclePage([], { pageSize: 10 })));
    renderSection();

    expect(await within(section()).findByText('No aging stock')).toBeVisible();
    expect(within(section()).queryByRole('list')).not.toBeInTheDocument();
    expect(within(section()).queryByRole('button')).not.toBeInTheDocument();
    // The empty message is not a new live region (MatchCount is the single announcer).
    expect(within(section()).queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a loading state while the aging vehicles load', async () => {
    mockAging(async () => {
      await delay('infinite');
      return HttpResponse.json(null);
    });
    renderSection();

    expect(await within(section()).findByText('Loading aging stock…')).toBeInTheDocument();
    expect(section()).toHaveAttribute('aria-busy', 'true');
    // Busy is reported on the section; no status region of its own (MatchCount announces).
    expect(within(section()).queryByRole('status')).not.toBeInTheDocument();
    expect(within(section()).queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows an error with Retry, and Retry loads the vehicles', async () => {
    let fail = true;
    mockAging(() =>
      fail
        ? HttpResponse.json(null, { status: 503 })
        : HttpResponse.json(buildVehiclePage(threeAging, { pageSize: 10 })),
    );
    const { user } = renderSection();

    const alert = await within(section()).findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load aging stock");
    fail = false;
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(
      await within(section()).findByRole('list', { name: 'Aging vehicles, oldest first' }),
    ).toBeVisible();
    expect(within(section()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the vehicles when a background refresh fails (60 s polling, ADR-007)', async () => {
    let fail = false;
    mockAging(() =>
      fail
        ? HttpResponse.json(null, { status: 503 })
        : HttpResponse.json(buildVehiclePage(threeAging, { pageSize: 10 })),
    );
    const { queryClient } = renderSection();
    await screen.findByRole('list', { name: 'Aging vehicles, oldest first' });

    fail = true;
    await act(() => queryClient.refetchQueries({ queryKey: ['inventory', 1, 'aging'] }));

    expect(within(section()).getAllByRole('listitem')).toHaveLength(3);
    expect(within(section()).queryByRole('alert')).not.toBeInTheDocument();
    // A quiet hint like the list's, not an alert or a status region.
    expect(
      await within(section()).findByText(
        "Couldn't refresh aging stock. Showing the last loaded vehicles.",
      ),
    ).toBeVisible();
    expect(within(section()).queryByRole('status')).not.toBeInTheDocument();
    expect(section()).not.toHaveAttribute('aria-busy');

    // The next successful refresh removes the hint.
    fail = false;
    await act(() => queryClient.refetchQueries({ queryKey: ['inventory', 1, 'aging'] }));
    await waitFor(() =>
      expect(within(section()).queryByText(/Couldn't refresh/)).not.toBeInTheDocument(),
    );
  });

  it('"View all" shows only Aging stock in the list, from page 1, and moves focus to the list (TA-11, TA-29, AC-004.3)', async () => {
    const { user, router } = renderSection({
      route: '/dealerships/1?q=stk&sort=price&order=desc&page=2',
    });
    expect(await screen.findByText('Showing 26-30 of 30')).toBeVisible();

    // Default mock data: Birmingham has 19 vehicles over 90 days.
    await user.click(await screen.findByRole('button', { name: 'View all 19 aging vehicles' }));

    // Other filters, sort and page are replaced, so the list shows exactly the 19 (TA-29).
    expect(router.state.location.search).toBe('?agingOnly=true');
    expect(router.state.historyAction).toBe('PUSH');
    expect(screen.getByRole('region', { name: 'Vehicle list' })).toHaveFocus();
    expect(await screen.findByText('Showing 1-19 of 19')).toBeVisible();
  });

  describe('"View all" with unapplied drafts (fake timers)', () => {
    afterEach(stopManualClock);

    it('discards a pending search and range draft: no stray search after the debounce (TA-29)', async () => {
      const listRequests: URLSearchParams[] = [];
      server.use(
        http.get(vehiclesUrl, ({ request }) => {
          if (!isAgingRequest(request)) listRequests.push(new URL(request.url).searchParams);
        }),
      );
      const { router } = renderWithProviders(
        <>
          <Harness />
          <FilterBar dealershipId={1} />
          <VehicleTable dealership={birmingham} />
        </>,
        { route: '/dealerships/1', path: '/dealerships/:dealershipId' },
      );
      const viewAll = await screen.findByRole('button', { name: 'View all 19 aging vehicles' });
      await screen.findByText('Showing 1-25 of 30');
      // From here the clock only moves when the test says so, so the search draft cannot commit
      // before "View all" is clicked; `delay: null` makes user-event itself use no timers.
      startManualClock();
      const user = userEvent.setup({ delay: null });
      const searchbox = screen.getByRole('searchbox', { name: 'Search' });
      const minDays = screen.getByRole('textbox', { name: 'Minimum days' });

      await user.type(minDays, '10');
      await user.type(searchbox, 'stk');
      await user.click(viewAll);

      expect(router.state.location.search).toBe('?agingOnly=true');
      // The draft-holding controls are remounted empty (new elements, so query them again).
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
      expect(screen.getByRole('textbox', { name: 'Minimum days' })).toHaveValue('');
      // Well past the 300 ms debounce: the discarded draft never commits.
      await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 3));
      expect(router.state.location.search).toBe('?agingOnly=true');
      expect(await screen.findByText('Showing 1-19 of 19')).toBeVisible();
      expect(listRequests.some((params) => params.has('q'))).toBe(false);
      expect(listRequests.some((params) => params.has('minAge'))).toBe(false);
    });
  });

  it('calls onSelectVehicle with the vehicle id when an item is selected (AC-004.4)', async () => {
    mockAging(() => HttpResponse.json(buildVehiclePage(threeAging, { pageSize: 10 })));
    const onSelectVehicle = vi.fn();
    const { user } = renderSection({}, onSelectVehicle);

    const list = await screen.findByRole('list', { name: 'Aging vehicles, oldest first' });
    await user.click(within(list).getByRole('button', { name: /STK-0008/ }));

    expect(onSelectVehicle).toHaveBeenCalledExactlyOnceWith(8);
  });

  it('never shows the previous dealership vehicles while another dealership loads (BR-04)', async () => {
    const { router } = renderSection();
    const list = await screen.findByRole('list', { name: 'Aging vehicles, oldest first' });
    expect(within(list).getByText('STK-1001')).toBeVisible();

    server.use(http.get(apiUrl('/dealerships/2/vehicles'), () => delay('infinite')));
    await act(() => router.navigate('/dealerships/2'));

    expect(await within(section()).findByText('Loading aging stock…')).toBeInTheDocument();
    expect(within(section()).queryByRole('list')).not.toBeInTheDocument();
    expect(within(section()).queryByText('STK-1001')).not.toBeInTheDocument();
  });

  it('renders in Vietnamese while vehicle data stays as stored (BR-19)', async () => {
    await i18n.changeLanguage('vi');
    mockAging(() => HttpResponse.json(buildVehiclePage(threeAging, { pageSize: 10 })));
    renderSection();

    const region = await screen.findByRole('region', { name: 'Xe tồn kho lâu' });
    const list = await within(region).findByRole('list', {
      name: 'Xe tồn kho lâu, cũ nhất trước',
    });
    await waitFor(() =>
      expect(
        within(list)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual([
        'STK-0007Ford Focus200 ngàyDự kiến giảm giá',
        'STK-0008Toyota Yaris150 ngàyChưa có hành độngCần xử lý',
        'STK-0009Kia Ceed95 ngàyChạy khuyến mãi',
      ]),
    );
    expect(
      within(region).getByRole('button', { name: 'Xem tất cả 3 xe tồn kho lâu' }),
    ).toBeVisible();
  });
});
