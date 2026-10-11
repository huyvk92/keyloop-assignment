import preview from '#.storybook/preview';
import { expect, fn } from 'storybook/test';
import { Checkbox } from '@/components/Checkbox';

const meta = preview.meta({
  title: 'Components/Checkbox',
  component: Checkbox,
  parameters: { layout: 'padded' },
  args: { label: 'Aging only', onChange: fn() },
});

export const Default = meta.story({});

export const Checked = meta.story({ args: { defaultChecked: true } });

export const WithHint = meta.story({ args: { hint: 'Vehicles in stock for more than 90 days.' } });

export const WithError = meta.story({
  args: { label: 'I confirm the price change', error: 'Confirm to continue' },
});

export const Disabled = meta.story({ args: { disabled: true } });

export const Toggle = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    const checkbox = canvas.getByRole('checkbox', { name: 'Aging only' });
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
    await expect(args.onChange).toHaveBeenCalledOnce();
  },
});
