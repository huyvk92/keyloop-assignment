import { screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { i18n } from '@/i18n';
import { apiUrl } from '@/lib/http';
import { buildSummary, fixtureDealerships } from '@/mocks/fixtures';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test/render';
import { getVehicles } from '../api/inventory.api';
import { inventoryKeys } from '../api/inventory.queries';
import { ExportButton } from './ExportButton';
import { FilterBar } from './FilterBar';

const vehiclesUrl = apiUrl('/dealerships/:dealershipId/vehicles');
const [birmingham] = fixtureDealerships;
if (!birmingham) throw new Error('fixture dealerships missing');

type Download = { fileName: string; bytes: Uint8Array; text: string; type: string };

/**
 * jsdom has no Blob URLs and can't follow a download: record what would be saved instead.
 * `createObjectURL` receives the Blob; the anchor's `click` is where the browser would save it.
 */
function captureDownloads() {
  const blobs = new Map<string, Blob>();
  const pending: Promise<Download>[] = [];
  const createObjectURL = vi.fn((blob: Blob) => {
    const url = `blob:test/${blobs.size + 1}`;
    blobs.set(url, blob);
    return url;
  });
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function record(
    this: HTMLAnchorElement,
  ) {
    const blob = blobs.get(this.href);
    if (!blob) throw new Error(`no blob for ${this.href}`);
    const fileName = this.download;
    pending.push(
      blob.arrayBuffer().then((buffer) => {
        const bytes = new Uint8Array(buffer);
        return { fileName, bytes, text: new TextDecoder().decode(bytes), type: blob.type };
      }),
    );
  });
  return { createObjectURL, revokeObjectURL, click, downloads: () => Promise.all(pending) };
}

/** Records the export's page requests (pageSize=100); the default handler still answers. */
function recordExportRequests() {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get(vehiclesUrl, ({ request }) => {
      const params = new URL(request.url).searchParams;
      if (params.get('pageSize') === '100') requests.push(params);
    }),
  );
  return requests;
}

// An arrow function declared after the check, so `birmingham` stays narrowed inside it.
const renderExport = (search = '') =>
  renderWithProviders(
    <FilterBar dealershipId={1} actions={<ExportButton dealership={birmingham} />} />,
    {
      route: `/dealerships/1${search}`,
      path: '/dealerships/:dealershipId',
    },
  );

const exportButton = () =>
  screen.getByRole('button', { name: /^(Export CSV|Exporting…|Xuất CSV)$/ });
const rows = (text: string) => text.split('\r\n').slice(0, -1);

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('ExportButton (T-044, US-013)', () => {
  it('downloads every filtered vehicle in the current sort as a CSV (AC-013.1)', async () => {
    const capture = captureDownloads();
    const requests = recordExportRequests();
    const { user, queryClient } = renderExport('?make=Ford&sort=price');
    // The KPI summary's dealership-local date names the file (TA-34).
    queryClient.setQueryData(inventoryKeys.summary(1), buildSummary({ asOfDate: '2026-10-07' }));
    await screen.findByText(/vehicles? match/);

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(capture.click).toHaveBeenCalledTimes(1));
    const [download] = await capture.downloads();
    expect(download?.fileName).toBe('inventory-birmingham-2026-10-07.csv');
    expect(download?.type).toBe('text/csv;charset=utf-8');
    // UTF-8 byte-order mark (AC-013.3).
    expect([...(download?.bytes.slice(0, 3) ?? [])]).toEqual([0xef, 0xbb, 0xbf]);

    // One page of 100 holds every Ford, with the URL's filters and sort.
    expect(requests).toHaveLength(1);
    expect(requests[0]?.get('make')).toBe('Ford');
    expect(requests[0]?.get('sort')).toBe('price');
    const expected = await getVehicles(1, { make: 'Ford', sort: 'price', pageSize: 100 });
    const [header, ...data] = rows(download?.text ?? '');
    expect(header).toMatch(/^Stock no\.,VIN,Make,Model,/);
    expect(data).toHaveLength(expected.total);
    expect(data.map((row) => row.split(',')[0])).toEqual(expected.items.map((v) => v.stockNumber));
    expect(data.every((row) => row.split(',')[2] === 'Ford')).toBe(true);

    await waitFor(() => expect(capture.revokeObjectURL).toHaveBeenCalledWith('blob:test/1'));
    expect(exportButton()).toHaveAccessibleName('Export CSV');
    expect(exportButton()).not.toHaveAttribute('aria-disabled');
  });

  it("names the file with the dealership's date when the summary isn't loaded", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 23:30 UTC on 7 Oct is already 8 Oct in Birmingham (BST).
    vi.setSystemTime(new Date('2026-10-07T23:30:00.000Z'));
    const capture = captureDownloads();
    const { user } = renderExport();
    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(capture.click).toHaveBeenCalledTimes(1));
    const [download] = await capture.downloads();
    expect(download?.fileName).toBe('inventory-birmingham-2026-10-08.csv');
  });

  it('is busy while exporting: aria-disabled, keeps focus, ignores a second click (AC-013.2)', async () => {
    const capture = captureDownloads();
    const requests: URL[] = [];
    server.use(
      http.get(vehiclesUrl, async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('pageSize') !== '100') return;
        requests.push(url);
        await delay('infinite');
      }),
    );
    const { user } = renderExport();
    await screen.findByText(/vehicles in stock/);

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const busy = await screen.findByRole('button', { name: 'Exporting…' });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    expect(busy).toHaveFocus();

    await user.click(busy);
    await user.keyboard('{Enter}');
    expect(requests).toHaveLength(1);
    expect(capture.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the mapped error and downloads nothing when a page fails (AC-013.2)', async () => {
    const capture = captureDownloads();
    server.use(
      http.get(vehiclesUrl, ({ request }) => {
        if (new URL(request.url).searchParams.get('pageSize') === '100') {
          return HttpResponse.json(
            { error: { code: 'INTERNAL', message: 'SQLITE_BUSY: raw detail' } },
            { status: 500 },
          );
        }
      }),
    );
    const { user } = renderExport();
    await screen.findByText(/vehicles in stock/);

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      "Couldn't export the vehicles. The server ran into a problem. Try again in a moment.",
    );
    expect(alert).not.toHaveTextContent('SQLITE_BUSY');
    expect(capture.createObjectURL).not.toHaveBeenCalled();
    expect(capture.click).not.toHaveBeenCalled();
    // Ready for a retry, focus kept.
    expect(exportButton()).toHaveAccessibleName('Export CSV');
    expect(exportButton()).toHaveFocus();
    expect(exportButton()).not.toHaveAttribute('aria-disabled');
  });

  it('clears the error when a retry succeeds', async () => {
    const capture = captureDownloads();
    let fail = true;
    server.use(
      http.get(vehiclesUrl, ({ request }) => {
        if (fail && new URL(request.url).searchParams.get('pageSize') === '100') {
          return HttpResponse.error();
        }
      }),
    );
    const { user } = renderExport();
    await screen.findByText(/vehicles in stock/);
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn't reach the server/);

    fail = false;
    await user.click(exportButton());
    await waitFor(() => expect(capture.click).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('writes Vietnamese headings and labels with untranslated data (AC-013.3)', async () => {
    await i18n.changeLanguage('vi');
    const capture = captureDownloads();
    const { user } = renderExport();
    await screen.findByText(/xe trong kho/);

    await user.click(screen.getByRole('button', { name: 'Xuất CSV' }));
    await waitFor(() => expect(capture.click).toHaveBeenCalledTimes(1));
    const [download] = await capture.downloads();
    const [header, ...data] = rows(download?.text ?? '');
    expect(header).toMatch(/^Mã tồn kho,Số VIN,Hãng xe,Mẫu xe,Đời xe,/);
    expect(data).toHaveLength(30);
    // Vehicle STK-1001's current action is "Marketing Promotion" (fixtures): its VI label.
    const first = data.find((row) => row.startsWith('STK-1001,'));
    expect(first).toContain(',Chạy khuyến mãi,Sam Patel,2026-10-07T11:00:00.000Z');
    expect(first).toContain(',Có,');
    // Data as stored: makes and models stay English.
    expect(data.some((row) => row.includes(',Ford,'))).toBe(true);
  });

  it('is unavailable with an explanation when nothing matches', async () => {
    const capture = captureDownloads();
    const requests = recordExportRequests();
    const { user } = renderExport('?q=zzzz-no-match');
    await screen.findByText(/0 vehicles match/);

    const button = screen.getByRole('button', { name: 'Export CSV' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('There are no vehicles to export.');
    await user.click(button);
    expect(requests).toHaveLength(0);
    expect(capture.createObjectURL).not.toHaveBeenCalled();
  });

  it('cancels the export when the button unmounts (dealership switch, leaving the page)', async () => {
    const capture = captureDownloads();
    const signals: AbortSignal[] = [];
    server.use(
      http.get(vehiclesUrl, async ({ request }) => {
        if (new URL(request.url).searchParams.get('pageSize') === '100') {
          signals.push(request.signal);
          await delay('infinite');
        }
      }),
    );
    const { user, unmount } = renderExport();
    await screen.findByText(/vehicles in stock/);
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(signals).toHaveLength(1));

    unmount();
    await waitFor(() => expect(signals[0]?.aborted).toBe(true));
    expect(capture.createObjectURL).not.toHaveBeenCalled();
  });
});
