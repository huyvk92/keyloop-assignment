import preview from '#.storybook/preview';
import { delay, http, HttpResponse } from 'msw';
import { expect } from 'storybook/test';
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
