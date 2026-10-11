import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { routes } from '@/app/router';
import { apiUrl } from '@/lib/http';
import { server } from '@/mocks/server';
import { preloadRouteModules, renderRoutes } from '@/test/render';

/**
 * States and error matrix (T-039, NFR-06): every query-driven region of the app in its loading,
 * error (+ Retry), empty and success states, through the real route tree with MSW. A 500 carries
 * internals in its body that must never reach the screen (AC-001.6, TRD section 6). Regions that
 * keep data on a failed background refresh show a quiet hint instead of an alert (§5.6).
 * Component tests cover each region's details; this file is the one place that checks them all
 * the same way.
 */

/** What a careless API might leak: must never be rendered. */
const RAW_ERROR = 'SQLITE_BUSY: database is locked (/srv/data/inventory.db)';
const RAW_CODE = 'INTERNAL_SERVER_ERROR';
const FRIENDLY_SERVER_ERROR = 'The server ran into a problem. Try again in a moment.';

const serverError = () =>
  HttpResponse.json({ error: { code: RAW_CODE, message: RAW_ERROR } }, { status: 500 });

const AGING_SEARCH = '?agingOnly=true&sort=age&order=desc&pageSize=10';
const isAging = (url: URL) => url.search === AGING_SEARCH;
const isList = (url: URL) => !isAging(url);

type Endpoint = { path: string; matches?: (url: URL) => boolean };

/** Answers `endpoint` with a 500 while `failing.on`; otherwise the default handlers answer. */
function failEndpoint({ path, matches = () => true }: Endpoint) {
  const failing = { on: true };
  server.use(
    http.get(apiUrl(path), ({ request }) =>
      failing.on && matches(new URL(request.url)) ? serverError() : undefined,
    ),
  );
  return failing;
}

/** Never answers `endpoint` (loading forever). */
function hangEndpoint({ path, matches = () => true }: Endpoint) {
  server.use(
    http.get(apiUrl(path), async ({ request }) => {
      if (matches(new URL(request.url))) await delay('infinite');
      return undefined;
    }),
  );
}

const expectNoRawError = () => {
  expect(document.body).not.toHaveTextContent(RAW_ERROR);
  expect(document.body).not.toHaveTextContent(RAW_CODE);
};

type Region = {
  name: string;
  endpoint: Endpoint;
  /** Dashboard URL to start from. */
  route: string;
  /** Opens the region when it is not on the page by default (the drawer). */
  open?: (user: UserEvent) => Promise<void>;
  /** The region's element, once present. */
  find: () => Promise<HTMLElement>;
  expectLoading: (region: HTMLElement) => unknown;
  /** Title of the error alert. */
  errorTitle: string;
  /** False when the region's alert has a fixed text instead of the mapped message. */
  mapsMessage?: boolean;
  expectSuccess: (region: HTMLElement) => Promise<unknown>;
  empty: {
    route: string;
    open?: (user: UserEvent) => Promise<void>;
    /** Text of the empty state; or `expect` for a region without one. */
    text?: string;
    expect?: (region: HTMLElement) => Promise<unknown>;
  };
  /** Quiet hint after a failed background refresh, when the region keeps its data. */
  refreshHint?: string;
};

const BIRMINGHAM = '/dealerships/1';
/** York has no stock (TA-15): every dashboard region is empty. */
const YORK = '/dealerships/4';

async function openFirstVehicle(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'View STK-1001' }));
}

/** A vehicle without any logged action, for the drawer's empty history. */
async function openVehicleWithoutHistory(user: UserEvent) {
  const list = await screen.findByRole('region', { name: 'Vehicle list' });
  const row = (await within(list).findAllByRole('row')).find((r) =>
    within(r).queryByText('No action'),
  );
  if (!row) throw new Error('no vehicle without an action in the fixtures');
  await user.click(within(row).getByRole('button', { name: /^View STK-/ }));
}

const regions: Region[] = [
  {
    name: 'KPIs',
    endpoint: { path: '/dealerships/:dealershipId/summary' },
    route: BIRMINGHAM,
    find: () => screen.findByRole('region', { name: 'Inventory summary' }),
    expectLoading: (region) => {
      expect(region).toHaveAttribute('aria-busy', 'true');
      expect(within(region).getByText('Loading…')).toBeInTheDocument();
    },
    errorTitle: "Couldn't load the inventory summary",
    expectSuccess: async (region) =>
      expect(
        await within(region).findByRole('definition', { name: 'Total vehicles' }),
      ).toHaveTextContent('30'),
    // AC-005.3: Total 0, Aging 0, 0%, "-" (read as "Not available").
    empty: { route: YORK, text: 'Not available' },
    refreshHint: "Couldn't refresh the summary. Showing the last loaded figures.",
  },
  {
    name: 'aging section',
    endpoint: { path: '/dealerships/:dealershipId/vehicles', matches: isAging },
    route: BIRMINGHAM,
    find: () => screen.findByRole('region', { name: 'Aging stock' }),
    expectLoading: (region) => {
      expect(region).toHaveAttribute('aria-busy', 'true');
      expect(within(region).getByText('Loading aging stock…')).toBeInTheDocument();
    },
    errorTitle: "Couldn't load aging stock",
    expectSuccess: (region) =>
      within(region).findByRole('list', { name: 'Aging vehicles, oldest first' }),
    empty: { route: YORK, text: 'No aging stock' }, // AC-004.2
    refreshHint: "Couldn't refresh aging stock. Showing the last loaded vehicles.",
  },
  {
    name: 'filter facets',
    endpoint: { path: '/dealerships/:dealershipId/facets' },
    route: BIRMINGHAM,
    find: () => screen.findByRole('search', { name: 'Filter vehicles' }),
    expectLoading: (region) =>
      expect(within(region).getByRole('combobox', { name: 'Make' })).toHaveAttribute(
        'aria-busy',
        'true',
      ),
    errorTitle: "Couldn't load the make and model options.",
    mapsMessage: false,
    expectSuccess: (region) => within(region).findByRole('option', { name: 'Ford' }),
    // No stock, no options: only "All makes" is offered.
    empty: {
      route: YORK,
      expect: async (region) => {
        const make = within(region).getByRole('combobox', { name: 'Make' });
        await waitFor(() => expect(make).not.toHaveAttribute('aria-busy'));
        expect(
          within(make)
            .getAllByRole('option')
            .map((option) => option.textContent),
        ).toEqual(['All makes']);
      },
    },
  },
  {
    name: 'vehicle list',
    endpoint: { path: '/dealerships/:dealershipId/vehicles', matches: isList },
    route: BIRMINGHAM,
    find: () => screen.findByRole('region', { name: 'Vehicle list' }),
    expectLoading: (region) => {
      // The other status in the region is the (empty) sort announcement.
      const busy = within(region)
        .getAllByRole('status')
        .filter((status) => status.getAttribute('aria-busy') === 'true');
      expect(busy).toHaveLength(1);
      expect(busy[0]).toHaveTextContent('Loading vehicles…');
    },
    errorTitle: "Couldn't load vehicles", // AC-001.6
    expectSuccess: (region) =>
      within(region).findByRole('table', { name: 'Vehicles in stock at Birmingham' }),
    empty: { route: YORK, text: 'No vehicles in stock' }, // AC-001.5
    refreshHint: "Couldn't refresh the list. Showing the last loaded data.",
  },
  {
    name: 'vehicle drawer',
    endpoint: { path: '/vehicles/:vehicleId' },
    route: BIRMINGHAM,
    open: openFirstVehicle,
    find: () => screen.findByRole('dialog'),
    expectLoading: (region) =>
      expect(within(region).getByRole('status')).toHaveTextContent('Loading vehicle details…'),
    errorTitle: "Couldn't load this vehicle",
    expectSuccess: (region) =>
      within(region).findByRole('heading', { level: 3, name: 'Action history' }),
    empty: {
      route: BIRMINGHAM,
      open: openVehicleWithoutHistory,
      text: 'No actions have been logged for this vehicle yet.',
    },
    refreshHint: "Couldn't refresh this vehicle. Showing the last loaded details.",
  },
  {
    name: 'dealership (dashboard page)',
    endpoint: { path: '/dealerships' },
    route: BIRMINGHAM,
    find: () => screen.findByRole('main'),
    expectLoading: (main) =>
      expect(within(main).getByRole('status')).toHaveTextContent('Loading dealership…'),
    errorTitle: "Couldn't load dealership",
    expectSuccess: (main) => within(main).findByRole('heading', { level: 1, name: 'Birmingham' }),
    // An unknown id is the "no such dealership" outcome, with a way back.
    empty: { route: '/dealerships/99', text: 'Dealership not found' },
  },
  {
    name: 'dealership list (redirect from "/")',
    endpoint: { path: '/dealerships' },
    route: '/',
    find: () => screen.findByRole('main'),
    expectLoading: (main) => {
      const status = within(main).getByRole('status');
      expect(status).toHaveTextContent('Loading dealerships…');
      expect(status).toHaveAttribute('aria-busy', 'true');
    },
    errorTitle: "Couldn't load dealerships",
    // Retry, then the redirect to the first dealership A-Z (AC-008.1).
    expectSuccess: (main) => within(main).findByRole('heading', { level: 1, name: 'Birmingham' }),
    empty: { route: '/', text: 'No dealerships found' },
  },
];

describe('States and error matrix (T-039, NFR-06)', () => {
  beforeAll(preloadRouteModules);

  describe.each(regions)('$name', (region) => {
    it('shows a loading state while its request is pending', async () => {
      hangEndpoint(region.endpoint);
      const { user } = renderRoutes(routes, { route: region.route });
      await region.open?.(user);

      const element = await region.find();
      await waitFor(() => region.expectLoading(element));
      expect(within(element).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows a friendly error with Retry on a 500, never the raw error, then recovers', async () => {
      const failing = failEndpoint(region.endpoint);
      const { user } = renderRoutes(routes, { route: region.route });
      await region.open?.(user);

      const element = await region.find();
      const alert = await within(element).findByRole('alert');
      expect(alert).toHaveTextContent(region.errorTitle);
      if (region.mapsMessage !== false) expect(alert).toHaveTextContent(FRIENDLY_SERVER_ERROR);
      expectNoRawError();

      failing.on = false;
      await user.click(within(alert).getByRole('button', { name: 'Retry' }));

      await region.expectSuccess(await region.find());
      expect(within(await region.find()).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows its empty state', async () => {
      if (region.name.startsWith('dealership list')) {
        server.use(http.get(apiUrl('/dealerships'), () => HttpResponse.json({ items: [] })));
      }
      const { user } = renderRoutes(routes, { route: region.empty.route });
      await region.empty.open?.(user);

      const element = await region.find();
      const { text, expect: expectEmpty } = region.empty;
      if (text) expect(await within(element).findByText(text)).toBeInTheDocument();
      await expectEmpty?.(element);
      expect(within(element).queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe.each(regions.filter((region) => region.refreshHint))('$name', (region) => {
    it('keeps its data and shows a quiet hint, not an alert, when a background refresh fails', async () => {
      const { user } = renderRoutes(routes, { route: region.route });
      await region.open?.(user);
      await region.expectSuccess(await region.find());

      failEndpoint(region.endpoint);
      await user.click(screen.getByRole('button', { name: 'Refresh' }));
      await screen.findByRole('button', { name: 'Refresh' });

      const element = await region.find();
      const hint = await within(element).findByText(region.refreshHint ?? '');
      expect(hint).toBeVisible();
      // Not inside any live region: a poll that fails must not speak.
      for (const live of [...screen.queryAllByRole('status'), ...screen.queryAllByRole('alert')]) {
        expect(live).not.toContainElement(hint);
      }
      expect(within(element).queryByRole('alert')).not.toBeInTheDocument();
      await region.expectSuccess(element);
      expectNoRawError();
    });
  });

  it('keeps the make and model options, without an alert, when a background refresh of the facets fails', async () => {
    const { user } = renderRoutes(routes, { route: BIRMINGHAM });
    const filters = await screen.findByRole('search', { name: 'Filter vehicles' });
    await within(filters).findByRole('option', { name: 'Ford' });

    failEndpoint({ path: '/dealerships/:dealershipId/facets' });
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByRole('button', { name: 'Refresh' });
    // The refresh has settled (the list refreshed too) before checking for the absence.
    await waitFor(() => expect(screen.queryByText('Updating…')).not.toBeInTheDocument());

    expect(within(filters).getByRole('option', { name: 'Ford' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows all three empty states and zero KPIs for a dealership without stock (York, AC-005.3)', async () => {
    renderRoutes(routes, { route: YORK });

    const kpis = await screen.findByRole('region', { name: 'Inventory summary' });
    expect(
      await within(kpis).findByRole('definition', { name: 'Total vehicles' }),
    ).toHaveTextContent('0');
    expect(within(kpis).getByRole('definition', { name: 'Aging' })).toHaveTextContent('0');
    expect(within(kpis).getByRole('definition', { name: '% aging' })).toHaveTextContent('0%');
    expect(
      within(kpis).getByRole('definition', { name: 'Average days in stock' }),
    ).toHaveTextContent('Not available');
    expect(await screen.findByText('No aging stock')).toBeVisible();
    expect(await screen.findByText('No vehicles in stock')).toBeVisible();
    expect(screen.queryByText('No vehicles match your filters')).not.toBeInTheDocument();
  });

  it('tells "no match" apart from "no stock", with Clear filters restoring the list (AC-002.8)', async () => {
    const { user } = renderRoutes(routes, { route: `${BIRMINGHAM}?q=no-such-vehicle` });

    const list = await screen.findByRole('region', { name: 'Vehicle list' });
    expect(await within(list).findByText('No vehicles match your filters')).toBeVisible();
    expect(within(list).queryByText('No vehicles in stock')).not.toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: 'Clear filters' }));

    expect(
      await within(list).findByRole('table', { name: 'Vehicles in stock at Birmingham' }),
    ).toBeVisible();
    expect(screen.getByRole('search', { name: 'Filter vehicles' })).toHaveFocus();
  });
});
