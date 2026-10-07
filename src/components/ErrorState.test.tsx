import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from '@/components/ErrorState';
import { ERROR_MESSAGES } from '@/lib/error-messages';
import { HttpError } from '@/lib/http';

describe('ErrorState', () => {
  it('shows the mapped, user-friendly message in an alert', () => {
    render(<ErrorState error={new HttpError(503, 'Request failed with status 503')} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(ERROR_MESSAGES.server);
    expect(alert).not.toHaveTextContent('Request failed with status 503');
  });

  it('shows the title', () => {
    render(<ErrorState title="Couldn't load vehicles" error={new Error('boom')} />);

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load vehicles");
  });

  it('calls onRetry when Retry is clicked (AC-001.6)', async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new Error('boom')} onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('has no Retry button when there is nothing to retry', () => {
    render(<ErrorState error={new Error('boom')} />);

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});
