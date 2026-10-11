import preview from '#.storybook/preview';
import { expect, fn } from 'storybook/test';
import { Select } from '@/components/Select';

const meta = preview.meta({
  title: 'Components/Select',
  component: Select,
  parameters: { layout: 'padded' },
  args: {
    'aria-label': 'Make',
    defaultValue: '',
    onChange: fn(),
    children: (
      <>
        <option value="">Any make</option>
        <option value="Ford">Ford</option>
        <option value="Toyota">Toyota</option>
      </>
    ),
  },
});

export const Default = meta.story({});

export const Small = meta.story({ args: { size: 'sm' } });

export const Invalid = meta.story({ args: { 'aria-invalid': true } });

export const Disabled = meta.story({ args: { disabled: true } });

export const ChooseOption = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    const select = canvas.getByRole('combobox', { name: 'Make' });
    await userEvent.selectOptions(select, 'Toyota');
    await expect(select).toHaveValue('Toyota');
    await expect(args.onChange).toHaveBeenCalledOnce();
  },
});
