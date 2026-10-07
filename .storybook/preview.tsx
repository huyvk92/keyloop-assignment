import addonA11y from '@storybook/addon-a11y';
import addonDocs from '@storybook/addon-docs';
import { definePreview } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupWorker } from 'msw/browser';
import addonMsw from 'msw-storybook-addon';
import { useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { handlers } from '@/mocks/handlers';
import '@/index.css';

/** Fresh QueryClient per story so cached data never leaks between stories. */
function StoryProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

export default definePreview({
  addons: [
    addonDocs(),
    addonA11y(),
    // Shared handlers from src/mocks; override per story with `beforeEach({ msw }) { msw.use(...) }`
    addonMsw(async () => {
      const worker = setupWorker(...handlers);
      await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
      return worker;
    }),
  ],
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    // Accessibility violations fail story tests
    a11y: { test: 'error' },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
});
