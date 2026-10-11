import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/EmptyState';

describe('EmptyState', () => {
  it('shows the title (AC-001.5)', () => {
    render(<EmptyState title="No vehicles in stock" />);

    expect(screen.getByRole('status')).toHaveTextContent('No vehicles in stock');
  });

  it('shows the description and an action slot', () => {
    render(
      <EmptyState title="No vehicles match your filters" description="Try widening your search.">
        <button type="button">Clear filters</button>
      </EmptyState>,
    );

    expect(screen.getByText('Try widening your search.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('can opt out of the status role when another region announces the same outcome', () => {
    render(<EmptyState title="No vehicles match your filters" announce={false} />);

    expect(screen.getByText('No vehicles match your filters')).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
