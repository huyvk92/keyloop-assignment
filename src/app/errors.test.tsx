import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/app/ErrorFallback';
import { RouteError } from '@/app/RouteError';
import { renderRoutes } from '@/test/render';

describe('ErrorFallback', () => {
  it('shows an alert and recovers when "Try again" is clicked', async () => {
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error('boom');
      return <p>Recovered</p>;
    }
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');

    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});

describe('RouteError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('shows status details for route error responses', async () => {
    renderRoutes(
      [
        {
          path: '/',
          errorElement: <RouteError />,
          loader: () => {
            throw new Response(null, { status: 403, statusText: 'Forbidden' });
          },
          element: <p>never</p>,
        },
      ],
      { route: '/' },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('403 Forbidden');
  });

  it('shows a generic message for unexpected errors', async () => {
    function Broken(): never {
      throw new Error('boom');
    }
    renderRoutes([{ path: '/', errorElement: <RouteError />, element: <Broken /> }]);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong while loading this page.',
    );
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });
});
