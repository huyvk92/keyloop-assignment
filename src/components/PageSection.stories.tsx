import preview from '#.storybook/preview';
import { expect } from 'storybook/test';
import { Button } from '@/components/Button';
import { PageSection } from '@/components/PageSection';

const meta = preview.meta({
  title: 'Components/PageSection',
  component: PageSection,
  parameters: { layout: 'padded' },
  args: { title: 'Birmingham', children: <p>Page content</p> },
});

export const Default = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Birmingham' })).toBeVisible();
  },
});

export const WithActions = meta.story({
  args: { actions: <Button variant="secondary">Refresh</Button> },
});
