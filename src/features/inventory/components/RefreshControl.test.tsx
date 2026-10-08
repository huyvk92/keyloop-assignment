import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { useParams } from 'react-router';
import {
  AgingSection,
  FilterBar,
  KpiCards,
  RefreshControl,
  VehicleTable,
} from '@/features/inventory';
import { i18n } from '@/i18n';
import { apiUrl } from '@/lib/http';
import { mockActionStore } from '@/mocks/action-store';
import { fixtureDealerships } from '@/mocks/fixtures';
import { server } from '@/mocks/server';
import { startManualClock, stopManualClock } from '@/test/manual-clock';
import { renderWithProviders } from '@/test/render';

/** Records every dealership request by kind; the default handlers still answer. */
function recordRequests() {
  const kinds: string[] = [];
  server.use(
    http.get(apiUrl('/dealerships/:dealershipId/:kind'), ({ request, params }) => {
      const url = new URL(request.url);
      const kind = String(params.kind);
      kinds.push(kind === 'vehicles' && url.searchParams.has('agingOnly') ? 'aging' : kind);
    }),
  );
  return kinds;
}

/** The dashboard's regions for the dealership in the path, plus the control under test. */
function Dashboard() {
  const dealershipId = Number(useParams().dealershipId);
  const dealership = fixtureDealerships.find((d) => d.id === dealershipId);
  if (!dealership) throw new Error(`no fixture dealership ${dealershipId}`);
  return (
    <>
      <RefreshControl dealership={dealership} />
      <KpiCards dealershipId={dealershipId} />
      <AgingSection dealershipId={dealershipId} />
      <FilterBar dealershipId={dealershipId} />
      <VehicleTable dealership={dealership} />
    </>
  );
}

function renderDashboard(search = '') {
  return renderWithProviders(<Dashboard />, {
    route: `/dealerships/1${search}`,
    path: '/dealerships/:dealershipId',
  });
}

const refreshButton = () => screen.getByRole('button', { name: /^(Refresh|Refreshing…)$/ });
const kpi = (name: string) =>
  within(screen.getByRole('region', { name: 'Inventory summary' })).getByRole('definition', {
    name,
  });

describe('RefreshControl (T-034)', () => {
  describe('with a manual clock', () => {
    afterEach(stopManualClock);

    it('refetches the summary, aging section, list and facets, and updates "Last updated" (AC-009.2)', async () => {
      startManualClock();
      // 13:32 UTC is 14:32 in Birmingham (Europe/London, BST).
      vi.setSystemTime(new Date('2026-10-07T13:32:00.000Z'));
      const requests = recordRequests();
      renderDashboard();
      expect(await screen.findByText('Showing 1-25 of 30')).toBeVisible();
      expect(await screen.findByText('Last updated 14:32')).toBeVisible();
      await waitFor(() =>
        expect([...requests].sort()).toEqual(['aging', 'facets', 'summary', 'vehicles']),
      );
      requests.length = 0;

      vi.setSystemTime(new Date('2026-10-07T13:47:00.000Z'));
      const user = userEvent.setup({ delay: null });
      await user.click(refreshButton());

      expect(await screen.findByText('Last updated 14:47')).toBeVisible();
      expect([...requests].sort()).toEqual(['aging', 'facets', 'summary', 'vehicles']);
      // "Last updated" is plain text, not a live region.
      expect(
        screen.queryAllByRole('status').filter((status) => status.textContent.includes('Last')),
      ).toEqual([]);
    });

    it('shows the oldest data on screen: a failed list refresh keeps the time (TA-31)', async () => {
      startManualClock();
      vi.setSystemTime(new Date('2026-10-07T13:32:00.000Z'));
      const requests = recordRequests();
      renderDashboard();
      expect(await screen.findByText('Showing 1-25 of 30')).toBeVisible();
      expect(await screen.findByText('Last updated 14:32')).toBeVisible();
      requests.length = 0;
      // The main list fails from now on (recorded here, as this handler answers it first); the
      // KPIs and the aging section still load.
      server.use(
        http.get(apiUrl('/dealerships/:dealershipId/vehicles'), ({ request }) => {
          if (new URL(request.url).searchParams.has('agingOnly')) return undefined;
          requests.push('vehicles');
          return HttpResponse.json({ error: 'boom' }, { status: 500 });
        }),
      );

      vi.setSystemTime(new Date('2026-10-07T13:47:00.000Z'));
      const user = userEvent.setup({ delay: null });
      await user.click(refreshButton());
      await waitFor(() => expect(refreshButton()).toHaveAccessibleName('Refresh'));

      expect(requests).toEqual(expect.arrayContaining(['summary', 'aging', 'vehicles']));
      // The list on screen is still the 14:32 one, so that is the time shown.
      expect(screen.getByText('Last updated 14:32')).toBeVisible();
      expect(screen.queryByText('Last updated 14:47')).not.toBeInTheDocument();
    });
  });

  it('shows the busy state with aria-disabled and keeps focus on the button (like Save)', async () => {
    const { user } = renderDashboard();
    await screen.findByText('Showing 1-25 of 30');
    await screen.findByText(/^Last updated/);
    server.use(http.get(apiUrl('/dealerships/:dealershipId/summary'), () => delay('infinite')));

    refreshButton().focus();
    await user.keyboard('{Enter}');

    const busy = await screen.findByRole('button', { name: 'Refreshing…' });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(busy).toHaveFocus();
    // The data stays on screen while it reloads.
    expect(screen.getByText('Showing 1-25 of 30')).toBeVisible();
  });

  it("shows another user's action after Refresh (AC-009.3)", async () => {
    const { user } = renderDashboard();
    const row = await screen.findByRole('row', { name: /STK-1002/ });
    expect(within(row).getByText('No action')).toBeVisible();
    await waitFor(() => expect(kpi('Needs attention')).toHaveTextContent(/^12$/));

    // Another manager logs an action on the server; nothing on this page changes by itself.
    mockActionStore.log(2, { status: 'Marketing Promotion', loggedBy: 'Sam Patel' });
    expect(within(row).getByText('No action')).toBeVisible();

    await user.click(refreshButton());

    await waitFor(() =>
      expect(screen.getByRole('row', { name: /STK-1002/ })).toHaveTextContent(
        'Marketing Promotion',
      ),
    );
    await waitFor(() => expect(kpi('Needs attention')).toHaveTextContent(/^11$/));
    const aging = screen.getByRole('list', { name: 'Aging vehicles, oldest first' });
    await waitFor(() =>
      expect(within(aging).getAllByRole('listitem')[1]).toHaveTextContent('Marketing Promotion'),
    );
  });

  it('keeps the URL filters, sort, page and typed input after a refresh (AC-009.1)', async () => {
    const { user, router } = renderDashboard('?minAge=10&sort=price&order=desc&page=2');
    await screen.findByText('Showing 26-30 of 30');
    // An unapplied range draft: form input that isn't in the URL yet.
    await user.type(screen.getByRole('textbox', { name: 'Maximum days' }), '150');
    const before = router.state.location;

    await user.click(refreshButton());
    await waitFor(() => expect(refreshButton()).toHaveAccessibleName('Refresh'));

    expect(router.state.location.search).toBe('?minAge=10&sort=price&order=desc&page=2');
    expect(router.state.location.key).toBe(before.key);
    expect(screen.getByText('Showing 26-30 of 30')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Minimum days' })).toHaveValue('10');
    expect(screen.getByRole('textbox', { name: 'Maximum days' })).toHaveValue('150');
    expect(screen.getByRole('columnheader', { name: 'List price' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('is translated in Vietnamese, with the same time format (BR-19)', async () => {
    await i18n.changeLanguage('vi');
    renderDashboard();

    expect(await screen.findByRole('button', { name: 'Làm mới' })).toBeVisible();
    expect(await screen.findByText(/^Cập nhật lúc \d{2}:\d{2}$/)).toBeVisible();
  });

  it('shows the busy label in Vietnamese', async () => {
    await i18n.changeLanguage('vi');
    const { user } = renderDashboard();
    await screen.findByText(/^Cập nhật lúc/);
    server.use(http.get(apiUrl('/dealerships/:dealershipId/summary'), () => delay('infinite')));

    await user.click(screen.getByRole('button', { name: 'Làm mới' }));

    expect(await screen.findByRole('button', { name: 'Đang làm mới…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('never refetches another dealership (BR-04)', async () => {
    const { user, router } = renderDashboard();
    await screen.findByText('Showing 1-25 of 30');
    await act(() => router.navigate('/dealerships/2'));
    await screen.findByText('Showing 1-4 of 4');
    const requests: string[] = [];
    server.use(
      http.get(apiUrl('/dealerships/:dealershipId/*'), ({ params }) => {
        requests.push(String(params.dealershipId));
      }),
    );

    await user.click(refreshButton());
    await waitFor(() => expect(requests.length).toBeGreaterThanOrEqual(3));

    expect(new Set(requests)).toEqual(new Set(['2']));
  });
});
