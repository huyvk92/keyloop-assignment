import preview from '#.storybook/preview';
import { delay, http, HttpResponse } from 'msw';
import { expect } from 'storybook/test';
import { apiUrl } from '@/lib/http';
import { KpiCards } from './KpiCards';

const summaryUrl = apiUrl('/dealerships/:dealershipId/summary');

const meta = preview.meta({
  title: 'Inventory/KpiCards',
  component: KpiCards,
  parameters: { layout: 'padded' },
  // Default MSW data: Birmingham (id 1) has 30 vehicles, 19 over 90 days, 12 of them without an
  // action.
  args: { dealershipId: 1 },
});

/** The five whole-stock KPIs on one row from `lg` (AC-005.1, AC-010.1). */
export const Default = meta.story({
  play: async ({ canvas }) => {
    const total = await canvas.findByRole('definition', { name: 'Total vehicles' });
    await expect(total).toHaveTextContent('30');
    await expect(canvas.getByRole('definition', { name: 'Aging' })).toHaveTextContent('19');
    await expect(canvas.getByRole('definition', { name: 'Needs attention' })).toHaveTextContent(
      '12',
    );
    await expect(canvas.getAllByRole('term')).toHaveLength(5);
  },
});

/** York (id 4) has no stock: 0 / 0 / 0% / "-" (AC-005.3). */
export const Empty = meta.story({
  args: { dealershipId: 4 },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('0%')).toBeVisible();
    await expect(canvas.getByText('-')).toBeVisible();
  },
});

export const Loading = meta.story({
  beforeEach({ msw }) {
    msw.use(http.get(summaryUrl, () => delay('infinite')));
  },
});

export const LoadError = meta.story({
  beforeEach({ msw }) {
    msw.use(http.get(summaryUrl, () => HttpResponse.json(null, { status: 503 })));
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      "Couldn't load the inventory summary",
    );
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible();
  },
});
