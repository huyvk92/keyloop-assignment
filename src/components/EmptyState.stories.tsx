import preview from '#.storybook/preview';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';

const meta = preview.meta({
  title: 'Components/EmptyState',
  component: EmptyState,
  parameters: { layout: 'padded' },
  args: { title: 'No vehicles in stock' },
});

export const Default = meta.story({});

export const WithAction = meta.story({
  args: {
    title: 'No vehicles match your filters',
    description: 'Try removing a filter or widening the age range.',
    children: (
      <Button variant="secondary" size="sm">
        Clear filters
      </Button>
    ),
  },
});
