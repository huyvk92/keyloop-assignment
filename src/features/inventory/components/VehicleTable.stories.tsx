import preview from '#.storybook/preview';
import { delay, http, HttpResponse } from 'msw';
import { expect, fn } from 'storybook/test';
import { apiUrl } from '@/lib/http';
import { fixtureDealerships } from '@/mocks/fixtures';
import { VehicleTable } from './VehicleTable';

const [birmingham, , , york] = fixtureDealerships;
if (!birmingham || !york) throw new Error('fixture dealerships missing');
const vehiclesUrl = apiUrl('/dealerships/:dealershipId/vehicles');

const meta = preview.meta({
  title: 'Inventory/VehicleTable',
  component: VehicleTable,
  parameters: { layout: 'padded' },
  args: { dealership: birmingham },
});

/** Default MSW data: 30 vehicles, oldest first, some aging, some with an action. */
export const Default = meta.story({
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('table', { name: 'Vehicles in stock at Birmingham' }),
    ).toBeVisible();
    await expect(canvas.getByText('Showing 1-25 of 30')).toBeVisible();
  },
});

/** Sortable headers: one click sorts ascending, `aria-sort` follows, one polite announcement (US-011). */
export const SortByPrice = meta.story({
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('table', { name: 'Vehicles in stock at Birmingham' });
    await userEvent.click(canvas.getByRole('button', { name: 'List price' }));
    await expect(await canvas.findByText('Sorted by price, ascending')).toHaveRole('status');
    await expect(canvas.getByRole('columnheader', { name: 'List price' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  },
});

/** Next page: the summary updates and focus stays on Next (AC-001.4). */
export const NextPage = meta.story({
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Showing 1-25 of 30');
    const next = canvas.getByRole('button', { name: 'Next page' });
    await userEvent.click(next);
    await expect(await canvas.findByText('Showing 26-30 of 30')).toBeVisible();
    await expect(next).toHaveFocus();
    await expect(next).toHaveAttribute('aria-disabled', 'true');
  },
});

export const Loading = meta.story({
  beforeEach({ msw }) {
    msw.use(http.get(vehiclesUrl, () => delay('infinite')));
  },
});

export const Empty = meta.story({
  args: { dealership: york },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No vehicles in stock')).toBeVisible();
  },
});

/** Filters in the URL match nothing: message plus Clear filters (AC-002.8). */
export const NoMatch = meta.story({
  parameters: { route: '/?q=no-such-vehicle' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No vehicles match your filters')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  },
});

export const LoadError = meta.story({
  beforeEach({ msw }) {
    msw.use(http.get(vehiclesUrl, () => HttpResponse.json(null, { status: 503 })));
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent("Couldn't load vehicles");
  },
});

/** With a handler, each row starts with a "View <stock number>" button (AC-004.4, T-030). */
export const Selectable = meta.story({
  args: { onSelectVehicle: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'View STK-1001' }));
    await expect(args.onSelectVehicle).toHaveBeenCalledWith(1);
  },
});
