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
});
