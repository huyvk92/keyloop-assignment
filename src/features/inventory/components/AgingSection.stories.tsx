import preview from '#.storybook/preview';
import { delay, http, HttpResponse } from 'msw';
import { expect, fn } from 'storybook/test';
import { apiUrl } from '@/lib/http';
import { AgingSection } from './AgingSection';

const vehiclesUrl = apiUrl('/dealerships/:dealershipId/vehicles');

const meta = preview.meta({
  title: 'Inventory/AgingSection',
  component: AgingSection,
  parameters: { layout: 'padded' },
  // Default MSW data: Birmingham (id 1) has 19 vehicles over 90 days.
  args: { dealershipId: 1 },
});

/** The 10 oldest aging vehicles with age and current action (AC-004.1). */
export const Default = meta.story({
  play: async ({ canvas }) => {
    const list = await canvas.findByRole('list', { name: 'Aging vehicles, oldest first' });
    await expect(list).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'View all 19 aging vehicles' })).toBeVisible();
  },
});

/** With a handler, each vehicle is a button that opens it (AC-004.4, T-030). */
export const Selectable = meta.story({
  args: { onSelectVehicle: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /STK-1001/ }));
    await expect(args.onSelectVehicle).toHaveBeenCalledWith(1);
  },
});

/** Manchester (id 3) has no vehicle over 90 days (AC-004.2). */
export const Empty = meta.story({
  args: { dealershipId: 3 },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No aging stock')).toBeVisible();
  },
});

export const Loading = meta.story({
  beforeEach({ msw }) {
    msw.use(http.get(vehiclesUrl, () => delay('infinite')));
  },
});

export const LoadError = meta.story({
  beforeEach({ msw }) {
    msw.use(http.get(vehiclesUrl, () => HttpResponse.json(null, { status: 503 })));
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent("Couldn't load aging stock");
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible();
  },
});
