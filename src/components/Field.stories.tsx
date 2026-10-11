import preview from '#.storybook/preview';
import { expect } from 'storybook/test';
import { Field } from '@/components/Field';
import { Select } from '@/components/Select';
import { TextInput } from '@/components/TextInput';

const meta = preview.meta({
  title: 'Components/Field',
  component: Field,
  parameters: { layout: 'padded' },
  args: {
    label: 'Logged by',
    children: (control) => <TextInput {...control} />,
  },
});

export const Default = meta.story({});

export const WithHint = meta.story({
  args: { hint: 'Your name as it should appear in the action history.' },
});

export const WithError = meta.story({
  args: {
    hint: 'Your name as it should appear in the action history.',
    error: 'Enter your name',
  },
  play: async ({ canvas }) => {
    const input = canvas.getByRole('textbox', { name: 'Logged by' });
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription(
      'Your name as it should appear in the action history. Enter your name',
    );
  },
});

export const InlineSelect = meta.story({
  args: {
    label: 'Sort by',
    layout: 'inline',
    children: (control) => (
      <Select {...control} size="sm" defaultValue="age">
        <option value="age">Days in stock</option>
        <option value="price">List price</option>
      </Select>
    ),
  },
});
