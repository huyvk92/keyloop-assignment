import preview from '#.storybook/preview';
import { delay, http, HttpResponse } from 'msw';
import { expect } from 'storybook/test';
import { apiUrl } from '@/lib/http';
import { buildSummary, fixtureDealerships } from '@/mocks/fixtures';
import { KpiCards } from './KpiCards';
import { RefreshControl } from './RefreshControl';

const summaryUrl = apiUrl('/dealerships/:dealershipId/summary');
const [birmingham] = fixtureDealerships;
if (!birmingham) throw new Error('fixtures have no dealership');

const meta = preview.meta({
  title: 'Inventory/RefreshControl',
  component: RefreshControl,
  parameters: { layout: 'padded' },
  args: { dealership: birmingham },
  // With the KPIs, so there is loaded data for "Last updated" to report.
  render: (args) => (
    <div className="space-y-4">
      <RefreshControl {...args} />
      <KpiCards dealershipId={args.dealership.id} />
    </div>
  ),
});

/** "Last updated HH:mm" (dealership time zone) and Refresh (AC-009.2). */
export const Default = meta.story({
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText(/^Last updated \d{2}:\d{2}$/)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }));
    await expect(await canvas.findByRole('button', { name: 'Refresh' })).toBeEnabled();
  },
});

/** While refreshing: `aria-disabled` and busy, focus kept; the figures stay on screen. */
export const Refreshing = meta.story({
  beforeEach({ msw }) {
    let calls = 0;
    msw.use(
      http.get(summaryUrl, async () => {
        calls += 1;
        if (calls > 1) await delay('infinite');
        return HttpResponse.json(buildSummary());
      }),
    );
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText(/^Last updated/);
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }));
    const busy = await canvas.findByRole('button', { name: 'Refreshing…' });
    await expect(busy).toHaveAttribute('aria-disabled', 'true');
    await expect(busy).toHaveFocus();
  },
});

/** Before anything has loaded there is no time to show, only the button. */
export const NothingLoadedYet = meta.story({
  beforeEach({ msw }) {
    msw.use(http.get(summaryUrl, () => delay('infinite')));
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Refresh' })).toBeVisible();
    await expect(canvas.queryByText(/^Last updated/)).not.toBeInTheDocument();
  },
});
