import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { server } from '@/mocks/server';
import { useUiStore } from '@/stores/ui-store';

// Register every Zustand store here so each test starts from its initial state.
const stores = [useUiStore];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  stores.forEach((store) => store.setState(store.getInitialState(), true));
});

afterAll(() => server.close());
