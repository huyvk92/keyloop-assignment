import type { SortKey } from '@shared/api/vehicles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { SortableHeader } from './SortableHeader';

function renderHeaders(props: Partial<ComponentProps<typeof SortableHeader>> = {}) {
  const onSort = vi.fn<(key: SortKey) => void>();
  render(
    <table>
      <thead>
        <tr>
          <SortableHeader
            label="Days in stock"
            sortKey="age"
            sort="price"
            order="asc"
            onSort={onSort}
            {...props}
          />
          <SortableHeader
            label="List price"
            sortKey="price"
            sort="price"
            order="asc"
            onSort={onSort}
            {...props}
          />
        </tr>
      </thead>
    </table>,
  );
  return { onSort, user: userEvent.setup() };
}

describe('SortableHeader (T-036)', () => {
  it('describes what the button sorts by when given a hint, keeping the label as its name', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortableHeader
              label="Make"
              sortKey="makeModel"
              sort="age"
              order="desc"
              onSort={vi.fn()}
              hint="Sorts by make, then model"
            />
          </tr>
        </thead>
      </table>,
    );

    expect(screen.getByRole('button', { name: 'Make' })).toHaveAccessibleDescription(
      'Sorts by make, then model',
    );
    // The hint is not part of the column header's name, read for every cell of the column.
    expect(screen.getByRole('columnheader', { name: 'Make' })).toBeInTheDocument();
  });

  it('is a column header with a button named by its label (AC-011.1)', () => {
    renderHeaders();

    const header = screen.getByRole('columnheader', { name: 'List price' });
    expect(header).toContainElement(screen.getByRole('button', { name: 'List price' }));
    expect(header).toHaveAttribute('scope', 'col');
  });

  it('puts aria-sort on the active column only (AC-011.3)', () => {
    renderHeaders();

    expect(screen.getByRole('columnheader', { name: 'List price' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.getByRole('columnheader', { name: 'Days in stock' })).not.toHaveAttribute(
      'aria-sort',
    );
  });

  it('reports descending for a descending sort', () => {
    renderHeaders({ order: 'desc' });

    expect(screen.getByRole('columnheader', { name: 'List price' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('asks for its own key on click and from the keyboard', async () => {
    const { onSort, user } = renderHeaders();

    await user.click(screen.getByRole('button', { name: 'Days in stock' }));
    await user.tab();
    await user.keyboard('{Enter}');

    expect(onSort.mock.calls).toEqual([['age'], ['price']]);
  });
});
