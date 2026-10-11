import preview from '#.storybook/preview';
import { LoadingState } from '@/components/LoadingState';

const meta = preview.meta({
  title: 'Components/LoadingState',
  component: LoadingState,
  parameters: { layout: 'padded' },
});

export const Default = meta.story({});

export const ManyRows = meta.story({ args: { rows: 8, label: 'Loading vehicles…' } });

/** Inside a region that sets `aria-busy` itself: no status region, the label stays sr-only. */
export const Quiet = meta.story({ args: { announce: false, label: 'Loading aging stock…' } });
