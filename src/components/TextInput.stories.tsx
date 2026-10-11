import preview from '#.storybook/preview';
import { TextInput } from '@/components/TextInput';

const meta = preview.meta({
  title: 'Components/TextInput',
  component: TextInput,
  parameters: { layout: 'padded' },
  args: { 'aria-label': 'Search stock no. or VIN', placeholder: 'e.g. STK-1042' },
});

export const Default = meta.story({});

export const Small = meta.story({ args: { size: 'sm' } });

export const Invalid = meta.story({ args: { 'aria-invalid': true, defaultValue: '1000' } });

export const Disabled = meta.story({ args: { disabled: true, defaultValue: 'STK-1042' } });
