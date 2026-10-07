import preview from '#.storybook/preview';
import { expect, fn } from 'storybook/test';
import { Button } from '@/components/Button';

const meta = preview.meta({
  title: 'Components/Button',
  component: Button,
  args: { children: 'Save', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
});

export const Primary = meta.story({});

export const Secondary = meta.story({ args: { variant: 'secondary' } });

export const Ghost = meta.story({ args: { variant: 'ghost' } });

export const Small = meta.story({ args: { size: 'sm' } });

export const Loading = meta.story({ args: { isLoading: true } });

export const Disabled = meta.story({ args: { disabled: true } });

export const ClickInteraction = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
});
