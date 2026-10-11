import preview from '#.storybook/preview';
import { delay, http, HttpResponse } from 'msw';
import { expect, waitFor } from 'storybook/test';
import { apiUrl } from '@/lib/http';
import { fixtureDealerships } from '@/mocks/fixtures';
import { ExportButton } from './ExportButton';

const vehiclesUrl = apiUrl('/dealerships/:dealershipId/vehicles');
const [birmingham] = fixtureDealerships;
if (!birmingham) throw new Error('fixture dealerships missing');

/** True for the export's own page requests (the list itself uses the default page size). */
const isExportRequest = (request: Request) =>
  new URL(request.url).searchParams.get('pageSize') === '100';

const meta = preview.meta({
  title: 'Inventory/ExportButton',
  component: ExportButton,
  parameters: { layout: 'padded' },
  args: { dealership: birmingham },
});

/** Ready: "Export CSV". Not clicked here, since a click downloads a real file. */
export const Default = meta.story({
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Export CSV' });
    await expect(button).toBeVisible();
    await expect(button).not.toHaveAttribute('aria-disabled');
  },
});

/** While exporting: "Exporting…", `aria-disabled` and busy, focus kept (AC-013.2). */
export const Exporting = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get(vehiclesUrl, async ({ request }) => {
        if (isExportRequest(request)) await delay('infinite');
      }),
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Export CSV' }));
    const busy = await canvas.findByRole('button', { name: 'Exporting…' });
    await expect(busy).toHaveAttribute('aria-disabled', 'true');
    await expect(busy).toHaveFocus();
  },
});

/** A failed page: the mapped message as an alert, no file (AC-013.2). */
export const ExportError = meta.story({
  name: 'Error',
  beforeEach({ msw }) {
    msw.use(
      http.get(vehiclesUrl, ({ request }) => {
        if (isExportRequest(request)) {
          return HttpResponse.json(
            { error: { code: 'INTERNAL', message: 'Internal Server Error' } },
            { status: 500 },
          );
        }
      }),
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Export CSV' }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      /Couldn't export the vehicles\. The server ran into a problem/,
    );
    await expect(canvas.getByRole('button', { name: 'Export CSV' })).toHaveFocus();
  },
});

/** Nothing matches the filters: unavailable, with a description. */
export const NothingToExport = meta.story({
  parameters: { route: '/?q=zzzz-no-match' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Export CSV' });
    // Once the (empty) list has loaded.
    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'true'));
    await expect(button).toHaveAccessibleDescription('There are no vehicles to export.');
  },
});
