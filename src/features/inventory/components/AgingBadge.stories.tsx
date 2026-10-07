import preview from '#.storybook/preview';
import { expect } from 'storybook/test';
import { AgingBadge } from './AgingBadge';

const meta = preview.meta({
  title: 'Inventory/AgingBadge',
  component: AgingBadge,
});

export const Default = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Aging')).toBeVisible();
  },
});
