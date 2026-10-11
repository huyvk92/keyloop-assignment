import preview from '#.storybook/preview';
import { expect, fn } from 'storybook/test';
import { ErrorState } from '@/components/ErrorState';
import { HttpError } from '@/lib/http';

const meta = preview.meta({
  title: 'Components/ErrorState',
  component: ErrorState,
  parameters: { layout: 'padded' },
  args: {
    error: new HttpError(503, 'Request failed with status 503'),
    onRetry: fn(),
  },
});

export const NetworkError = meta.story({});

export const NotFound = meta.story({
  args: {
    title: "Couldn't load dealership",
    error: new HttpError(404, 'Request failed with status 404', {
      error: { code: 'NOT_FOUND', message: 'Dealership not found' },
    }),
  },
});

export const VehicleNotAging = meta.story({
  args: {
    title: "Couldn't save action",
    error: new HttpError(422, 'Request failed with status 422', {
      error: { code: 'VEHICLE_NOT_AGING', message: 'Vehicle is not aging' },
    }),
  },
});

export const WithoutRetry = meta.story({ args: { onRetry: undefined } });

export const RetryInteraction = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
});
