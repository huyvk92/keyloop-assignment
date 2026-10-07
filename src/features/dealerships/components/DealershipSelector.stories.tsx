import preview from '#.storybook/preview';
import { delay, http, HttpResponse } from 'msw';
import { expect } from 'storybook/test';
import { apiUrl } from '@/lib/http';
import { DealershipSelector } from './DealershipSelector';

const dealershipsUrl = apiUrl('/dealerships');

const meta = preview.meta({
  title: 'Dealerships/DealershipSelector',
  component: DealershipSelector,
  parameters: { layout: 'padded' },
  args: { dealershipId: 1 },
});

/** Default MSW data: 4 dealerships A-Z, the one in the URL selected. */
export const Default = meta.story({
  play: async ({ canvas }) => {
    const select = await canvas.findByRole('combobox', { name: 'Dealership' });
    await expect(await canvas.findByRole('option', { name: 'York' })).toBeInTheDocument();
    await expect(select).toHaveDisplayValue('Birmingham');
  },
});

export const OtherSelected = meta.story({ args: { dealershipId: 3 } });

export const Vietnamese = meta.story({ globals: { locale: 'vi' } });

/** Disabled with a loading option until the list arrives. */
export const Loading = meta.story({
  beforeEach({ msw }) {
    msw.use(http.get(dealershipsUrl, () => delay('infinite')));
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('combobox', { name: 'Dealership' })).toBeDisabled();
  },
});

/** Renders nothing: the dashboard page shows the dealerships error with Retry. */
export const LoadError = meta.story({
  beforeEach({ msw }) {
    msw.use(http.get(dealershipsUrl, () => HttpResponse.json(null, { status: 503 })));
  },
});
