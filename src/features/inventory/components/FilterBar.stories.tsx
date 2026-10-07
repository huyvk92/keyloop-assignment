import preview from '#.storybook/preview';
import { delay, http, HttpResponse } from 'msw';
import { expect } from 'storybook/test';
import { apiUrl } from '@/lib/http';
import { FilterBar } from './FilterBar';

const facetsUrl = apiUrl('/dealerships/:dealershipId/facets');

const meta = preview.meta({
  title: 'Inventory/FilterBar',
  component: FilterBar,
  parameters: { layout: 'padded' },
  args: { dealershipId: 1 },
});

/** No filters: every make and model offered, total stock announced. */
export const Default = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('30 vehicles in stock')).toBeVisible();
    await expect(await canvas.findByRole('option', { name: 'Volkswagen' })).toBeInTheDocument();
  },
});

/** Controls restored from the URL (AC-002.7); model options limited to Ford (BR-06). */
export const WithFilters = meta.story({
  parameters: { route: '/?make=Ford&model=Focus&ageBucket=over-90&q=stk&minAge=100' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('1 vehicle matches your filters')).toBeVisible();
    await expect(canvas.getByRole('combobox', { name: 'Model' })).toHaveDisplayValue('Focus');
  },
});

/** Choosing a make narrows the model options and updates the count (AC-002.1, AC-002.2). */
export const ChooseMake = meta.story({
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('option', { name: 'Ford' });
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Make' }), 'Ford');
    await expect(await canvas.findByText('6 vehicles match your filters')).toBeVisible();
    await expect(canvas.queryByRole('option', { name: 'Corolla' })).not.toBeInTheDocument();
  },
});

/** Inline validation of the custom range (AC-002.4). */
export const InvalidAgeRange = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: 'Minimum days' }), '100');
    await userEvent.type(canvas.getByRole('textbox', { name: 'Maximum days' }), '50');
    await userEvent.click(canvas.getByRole('button', { name: 'Apply range' }));
    await expect(
      await canvas.findByText('Minimum days must be less than or equal to maximum days.'),
    ).toBeVisible();
  },
});

/** Selects are busy until the facets arrive; a value from the URL is still shown. */
export const FacetsLoading = meta.story({
  parameters: { route: '/?make=Ford' },
  beforeEach({ msw }) {
    msw.use(http.get(facetsUrl, () => delay('infinite')));
  },
});

/** The facets failed: an alert with Retry; the other filters keep working. */
export const FacetsError = meta.story({
  beforeEach({ msw }) {
    msw.use(http.get(facetsUrl, () => HttpResponse.json(null, { status: 503 })));
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      "Couldn't load the make and model options.",
    );
  },
});

export const Vietnamese = meta.story({ globals: { locale: 'vi' } });
