import preview from '#.storybook/preview';
import { expect } from 'storybook/test';
import { AttentionBadge } from './AttentionBadge';

const meta = preview.meta({
  title: 'Inventory/AttentionBadge',
  component: AttentionBadge,
});

/** Aging with "No action" (BR-16): visible text plus a decorative icon (AC-010.1). */
export const Default = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Needs attention')).toBeVisible();
  },
});
