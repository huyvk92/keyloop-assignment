import { ErrorBoundary } from 'react-error-boundary';
import { RouterProvider } from 'react-router';
import { ErrorFallback } from '@/app/ErrorFallback';
import { Providers } from '@/app/providers';
import { router } from '@/app/router';

export function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </ErrorBoundary>
  );
}
