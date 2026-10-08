import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { i18n } from '@/i18n';
import { server } from '@/mocks/server';
import { useUiStore } from '@/stores/ui-store';

// findBy*/waitFor budget. The 1 s default flaked on cold lazy-route imports; the causes of the
// later 3 s flakes under coverage were removed instead of raising it (workers capped in
// vite.config.ts, lazy routes preloaded from the router, cheaper table queries, split
// multi-step tests). Must stay well below testTimeout (15 s, vite.config.ts).
configure({ asyncUtilTimeout: 3000 });

// Register every Zustand store here so each test starts from its initial state.
const stores = [useUiStore];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  stores.forEach((store) => store.setState(store.getInitialState(), true));
  // Tests render in English (ADR-009); a test that switches to Vietnamese is undone here.
  window.localStorage.clear();
  await i18n.changeLanguage('en');
});

afterAll(() => server.close());
