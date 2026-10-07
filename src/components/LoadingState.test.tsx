import { render, screen } from '@testing-library/react';
import { LoadingState } from '@/components/LoadingState';

describe('LoadingState', () => {
  it('announces a busy status with a default label', () => {
    render(<LoadingState />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading…');
  });

  it('uses a custom label', () => {
    render(<LoadingState label="Loading vehicles…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading vehicles…');
  });
});
