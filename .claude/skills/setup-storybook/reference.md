# setup-storybook: reference files

Verified on 2026-10-07 with Storybook 10.6, msw-storybook-addon 3.0, and Vite 8.
`npm run build-storybook` passes and indexes all `Button` stories.

### `.storybook/main.ts`

```tsx
import { defineMain } from '@storybook/react-vite/node';

export default defineMain({
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', 'msw-storybook-addon'],
  // Serves public/mockServiceWorker.js for msw-storybook-addon
  staticDirs: ['../public'],
});
```

### `.storybook/preview.tsx`

```tsx
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
```

### `src/components/Button.stories.tsx`

```tsx
import preview from '#.storybook/preview';
import { expect, fn } from 'storybook/test';
import { Button } from '@/components/Button';

const meta = preview.meta({
  title: 'Components/Button',
  component: Button,
  args: { children: 'Save', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
});

export const Primary = meta.story({});

export const Secondary = meta.story({ args: { variant: 'secondary' } });

export const Ghost = meta.story({ args: { variant: 'ghost' } });

export const Small = meta.story({ args: { size: 'sm' } });

export const Loading = meta.story({ args: { isLoading: true } });

export const Disabled = meta.story({ args: { disabled: true } });

export const ClickInteraction = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
});
```

