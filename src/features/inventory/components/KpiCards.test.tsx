import { act, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { useParams } from 'react-router';
import { FilterBar, KpiCards } from '@/features/inventory';
import { i18n } from '@/i18n';
import { apiUrl } from '@/lib/http';
import { buildSummary } from '@/mocks/fixtures';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test/render';

const summaryUrl = apiUrl('/dealerships/:dealershipId/summary');

function mockSummary(respond: () => Response | Promise<Response>) {
  server.use(http.get(summaryUrl, respond));
}

/** Reads the dealership from the path, like the page, so a switch can be tested. */
function Harness({ withFilters = false }: { withFilters?: boolean }) {
  const dealershipId = Number(useParams().dealershipId);
  return (
    <>
      <KpiCards dealershipId={dealershipId} />
      {withFilters && <FilterBar dealershipId={dealershipId} />}
    </>
  );
}

function renderKpis({
  route = '/dealerships/1',
  withFilters,
}: { route?: string; withFilters?: boolean } = {}) {
  return renderWithProviders(<Harness withFilters={withFilters} />, {
    route,
    path: '/dealerships/:dealershipId',
  });
}

const region = () => screen.getByRole('region', { name: 'Inventory summary' });
/** A KPI value, found by its term (each `<dd>` is labelled by its `<dt>`). */
const kpi = (name: string) => within(region()).getByRole('definition', { name });

describe('KpiCards', () => {
  it('shows the AC-005.1 summary as a list of terms and values (AC-005.1)', async () => {
    mockSummary(() => HttpResponse.json(buildSummary()));
    renderKpis();

    expect(await within(region()).findByText('37.5%')).toBeVisible();
    expect(
      within(region())
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Total vehicles', 'Aging', '% aging', 'Average days in stock']);
    expect(kpi('Total vehicles')).toHaveTextContent('8');
    expect(kpi('Aging')).toHaveTextContent('3');
    expect(kpi('% aging')).toHaveTextContent('37.5%');
    expect(kpi('Average days in stock')).toHaveTextContent('75');
    expect(region()).not.toHaveAttribute('aria-busy');
  });

  it('shows "-" for the average when there are no vehicles (AC-005.3, BR-15)', async () => {
    mockSummary(() =>
      HttpResponse.json(
        buildSummary({
          totalVehicles: 0,
          agingCount: 0,
          agingPercent: 0,
          averageDaysInStock: null,
          needsAttentionCount: 0,
        }),
      ),
    );
    renderKpis();

    expect(await within(region()).findByText('0%')).toBeVisible();
    expect(kpi('Total vehicles')).toHaveTextContent('0');
    expect(kpi('Aging')).toHaveTextContent('0');
    // "-" on screen; screen readers get words instead of a bare dash.
    expect(within(kpi('Average days in stock')).getByText('-')).toBeVisible();
    expect(kpi('Average days in stock')).toHaveTextContent('-Not available');
  });

  it('groups large counts with the locale separator', async () => {
    mockSummary(() => HttpResponse.json(buildSummary({ totalVehicles: 1200, agingCount: 300 })));
    renderKpis();

    expect(await within(region()).findByText('1,200')).toBeVisible();
    expect(kpi('Aging')).toHaveTextContent('300');
  });

  it('does not refetch the summary when the list filters change (AC-005.2, BR-15)', async () => {
    const requests: URL[] = [];
    server.use(
      http.get(summaryUrl, ({ request }) => {
        requests.push(new URL(request.url));
      }),
    );
    const { user, router } = renderKpis({ withFilters: true });
    expect(await screen.findByText('30 vehicles in stock')).toBeVisible();
    const total = kpi('Total vehicles').textContent;
    expect(total).toBe('30');

    await user.click(screen.getByRole('checkbox', { name: 'Aging only (over 90 days)' }));
    expect(await screen.findByText('19 vehicles match your filters')).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Make' }), 'Ford');
    expect(await screen.findByText('3 vehicles match your filters')).toBeVisible();

    expect(router.state.location.search).toBe('?make=Ford&agingOnly=true');
    expect(requests).toHaveLength(1);
    // Exactly the summary path: no filter is ever sent.
    expect(requests[0]?.search).toBe('');
    expect(kpi('Total vehicles')).toHaveTextContent('30');
    expect(kpi('Aging')).toHaveTextContent('19');
  });

  it('shows the labels with a loading value while the summary loads', async () => {
    mockSummary(async () => {
      await delay('infinite');
      return HttpResponse.json(null);
    });
    renderKpis();

    expect(region()).toHaveAttribute('aria-busy', 'true');
    expect(within(region()).getAllByRole('term')).toHaveLength(4);
    // "Loading…" is said once for the section; the value skeletons are hidden, not repeated.
    expect(within(region()).getAllByText('Loading…')).toHaveLength(1);
    expect(kpi('Total vehicles')).toHaveTextContent('');
    expect(kpi('Average days in stock')).toHaveTextContent('');
    // No status region of its own (MatchCount is the single announcer).
    expect(within(region()).queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows an error with Retry, and Retry loads the summary', async () => {
    let fail = true;
    mockSummary(() =>
      fail ? HttpResponse.json(null, { status: 503 }) : HttpResponse.json(buildSummary()),
    );
    const { user } = renderKpis();

    const alert = await within(region()).findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load the inventory summary");
    expect(within(region()).queryByRole('term')).not.toBeInTheDocument();
    fail = false;
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await within(region()).findByText('37.5%')).toBeVisible();
    expect(within(region()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the last values when a background refresh fails (60 s polling, ADR-007)', async () => {
    let fail = false;
    mockSummary(() =>
      fail ? HttpResponse.json(null, { status: 503 }) : HttpResponse.json(buildSummary()),
    );
    const { queryClient } = renderKpis();
    await within(region()).findByText('37.5%');

    fail = true;
    await act(() => queryClient.refetchQueries({ queryKey: ['inventory', 1, 'summary'] }));

    expect(kpi('% aging')).toHaveTextContent('37.5%');
    expect(within(region()).queryByRole('alert')).not.toBeInTheDocument();
    // A quiet hint like the list's, not an alert or a status region.
    expect(
      await within(region()).findByText(
        "Couldn't refresh the summary. Showing the last loaded figures.",
      ),
    ).toBeVisible();
    expect(within(region()).queryByRole('status')).not.toBeInTheDocument();

    // The next successful refresh removes the hint.
    fail = false;
    await act(() => queryClient.refetchQueries({ queryKey: ['inventory', 1, 'summary'] }));
    await waitFor(() =>
      expect(within(region()).queryByText(/Couldn't refresh/)).not.toBeInTheDocument(),
    );
  });

  it('never shows the previous dealership values while another dealership loads (BR-04)', async () => {
    mockSummary(() => HttpResponse.json(buildSummary()));
    const { router } = renderKpis();
    await within(region()).findByText('37.5%');

    server.use(http.get(apiUrl('/dealerships/4/summary'), () => delay('infinite')));
    await act(() => router.navigate('/dealerships/4'));

    expect(region()).toHaveAttribute('aria-busy', 'true');
    expect(within(region()).getByText('Loading…')).toBeInTheDocument();
    expect(within(region()).queryByText('37.5%')).not.toBeInTheDocument();
    expect(within(region()).queryByText('75')).not.toBeInTheDocument();
  });

  it('renders in Vietnamese with the Vietnamese decimal comma (BR-19, AC-015.4)', async () => {
    await i18n.changeLanguage('vi');
    mockSummary(() => HttpResponse.json(buildSummary({ totalVehicles: 1200 })));
    renderKpis();

    const vi = await screen.findByRole('region', { name: 'Tổng quan tồn kho' });
    expect(await within(vi).findByText('37,5%')).toBeVisible();
    expect(within(vi).getByRole('definition', { name: 'Tổng số xe' })).toHaveTextContent('1.200');
    expect(within(vi).getByRole('definition', { name: 'Tồn kho lâu' })).toHaveTextContent('3');
    expect(within(vi).getByRole('definition', { name: '% tồn kho lâu' })).toHaveTextContent(
      '37,5%',
    );
    expect(
      within(vi).getByRole('definition', { name: 'Số ngày tồn kho trung bình' }),
    ).toHaveTextContent('75');
  });
});
