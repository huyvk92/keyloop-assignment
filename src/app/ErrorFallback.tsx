import type { FallbackProps } from 'react-error-boundary';
import { Button } from '@/components/Button';

export function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-slate-600">An unexpected error occurred. Please try again.</p>
      <Button className="mt-4" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  );
}
