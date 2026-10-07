import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { i18n } from '@/i18n';
import { server } from '@/mocks/server';
import { useUiStore } from '@/stores/ui-store';

// Lazy routes pay a cold dynamic import on first render; the 1 s default flakes under CPU load.
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
