import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/lib/query-client';

type Props = { children: ReactNode };

export function Providers({ children }: Props) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Devtools are excluded from production builds automatically */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
