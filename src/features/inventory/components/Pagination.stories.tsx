import preview from '#.storybook/preview';
import { expect, fn } from 'storybook/test';
import { Pagination } from './Pagination';

const meta = preview.meta({
  title: 'Inventory/Pagination',
  component: Pagination,
  parameters: { layout: 'padded' },
  args: { page: 1, pageSize: 25, total: 312, onPageChange: fn() },
});

export const FirstPage = meta.story({});

export const MiddlePage = meta.story({ args: { page: 2 } });

export const LastPage = meta.story({ args: { page: 13 } });

export const SinglePage = meta.story({ args: { total: 12 } });

export const NextInteraction = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }));
    await expect(args.onPageChange).toHaveBeenCalledWith(2);
  },
});
