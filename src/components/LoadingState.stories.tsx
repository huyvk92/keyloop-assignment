import preview from '#.storybook/preview';
import { LoadingState } from '@/components/LoadingState';

const meta = preview.meta({
  title: 'Components/LoadingState',
  component: LoadingState,
  parameters: { layout: 'padded' },
});

export const Default = meta.story({});

export const ManyRows = meta.story({ args: { rows: 8, label: 'Loading vehicles…' } });
