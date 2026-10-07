import addonA11y from '@storybook/addon-a11y';
import addonDocs from '@storybook/addon-docs';
import { definePreview } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupWorker } from 'msw/browser';
import addonMsw from 'msw-storybook-addon';
import { useEffect, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { i18n, LANGUAGE_NAMES, toLanguage } from '@/i18n';
import { handlers } from '@/mocks/handlers';
import '@/index.css';

/**
 * Fresh QueryClient per story so cached data never leaks between stories. `locale` comes from
 * the toolbar; it switches the i18n language only (not stored, so reloading Storybook is English).
 * `route` (from `parameters.route`) is the router's initial URL.
 */
type ProvidersProps = { locale: unknown; route: unknown; children: ReactNode };

function StoryProviders({ locale, route, children }: ProvidersProps) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  const language = toLanguage(locale);
  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [language]);
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        {/* `parameters.route` opens a story at a URL, e.g. one with filters in the search params. */}
        <MemoryRouter initialEntries={typeof route === 'string' ? [route] : undefined}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
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
  // Locale toolbar (US-015): render any story in English (default) or Vietnamese.
  globalTypes: {
    locale: {
      description: 'UI language',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'en', title: LANGUAGE_NAMES.en },
          { value: 'vi', title: LANGUAGE_NAMES.vi },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: 'en' },
  parameters: {
    layout: 'centered',
    // Accessibility violations fail story tests
    a11y: { test: 'error' },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
  decorators: [
    (Story, { globals, parameters }) => (
      <StoryProviders locale={globals.locale} route={parameters.route}>
        <Story />
      </StoryProviders>
    ),
  ],
});
