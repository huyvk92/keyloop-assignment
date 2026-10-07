import preview from '#.storybook/preview';
import { Badge } from '@/components/Badge';

const meta = preview.meta({
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'In stock' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['neutral', 'aging', 'attention'] },
  },
});

export const Neutral = meta.story({});

export const Aging = meta.story({ args: { tone: 'aging', children: 'Aging' } });

export const Attention = meta.story({ args: { tone: 'attention', children: 'Needs attention' } });

export const WithIcon = meta.story({
  args: {
    tone: 'aging',
    children: 'Aging',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
        <circle cx="8" cy="8" r="6" />
      </svg>
    ),
  },
});
