import preview from '#.storybook/preview';
import { expect, fn } from 'storybook/test';
import type { ComponentProps } from 'react';
import { SortableHeader } from './SortableHeader';

const args: ComponentProps<typeof SortableHeader> = {
  label: 'List price',
  sortKey: 'price',
  sort: 'price',
  order: 'asc',
  onSort: fn(),
};

const meta = preview.meta({
  title: 'Inventory/SortableHeader',
  component: SortableHeader,
  parameters: { layout: 'padded' },
  args,
  // A `<th>` needs a table around it to be valid (and for the a11y check).
  decorators: [
    (Story) => (
      <table className="text-left text-xs font-semibold text-slate-700 uppercase">
        <thead className="bg-slate-50">
          <tr>
            <Story />
          </tr>
        </thead>
      </table>
    ),
  ],
});

/** Active column, ascending (`aria-sort="ascending"`). */
export const Ascending = meta.story({
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('columnheader', { name: 'List price' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'List price' }));
    await expect(args.onSort).toHaveBeenCalledWith('price');
  },
});

/** Active column, descending. */
export const Descending = meta.story({ args: { order: 'desc' } });

/** Another column is the active sort: no `aria-sort`, faint double arrow. */
export const Inactive = meta.story({
  args: { sort: 'age', order: 'desc' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('columnheader', { name: 'List price' })).not.toHaveAttribute(
      'aria-sort',
    );
  },
});

/** A header whose key isn't its label alone: the hint is the button's accessible description. */
export const WithHint = meta.story({
  args: { label: 'Make', sortKey: 'makeModel', hint: 'Sorts by make, then model' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Make' })).toHaveAccessibleDescription(
      'Sorts by make, then model',
    );
  },
});
