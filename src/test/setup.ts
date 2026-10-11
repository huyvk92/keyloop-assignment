import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
// The store module only, not the feature barrel: every test file loads this setup, and the barrel
// would pull in the feature's components (dialog, form) for all of them.
import { useLoggedByStore } from '@/features/vehicle-actions/store';
import { i18n } from '@/i18n';
import { resetMockActionStore } from '@/mocks/action-store';
import { server } from '@/mocks/server';
import { useUiStore } from '@/stores/ui-store';

// findBy*/waitFor budget. The 1 s default flaked on cold lazy-route imports; the causes of the
// later 3 s flakes under coverage were removed instead of raising it (workers capped in
// vite.config.ts, lazy routes preloaded from the router, cheaper table queries, split
// multi-step tests). Must stay well below testTimeout (15 s, vite.config.ts).
configure({ asyncUtilTimeout: 3000 });

/*
 * Minimal <dialog> stub (ADR-006, TRD risk "jsdom lacks HTMLDialogElement.showModal"). jsdom 29
 * reflects `open` and hides `dialog:not([open])`, but has no `showModal`/`close` and no Escape
 * handling. This only toggles `open`, fires `close`, and turns Escape into the cancellable
 * `cancel` event. It does NOT emulate the top layer, the inert background or the browser's own
 * focus steps: those are verified in Storybook and the manual keyboard pass (T-038).
 */
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  document.addEventListener('keydown', (event) => {
    const dialogs = document.querySelectorAll('dialog[open]');
    const top = dialogs[dialogs.length - 1];
    if (event.key !== 'Escape' || !(top instanceof HTMLDialogElement)) return;
    if (top.dispatchEvent(new Event('cancel', { cancelable: true }))) top.close();
  });
}

type ResettableStore<S> = {
  getInitialState: () => S;
  setState: (state: S, replace: true) => unknown;
};
const resetter =
  <S>(store: ResettableStore<S>) =>
  () =>
    store.setState(store.getInitialState(), true);

// Register every Zustand store here so each test starts from its initial state.
const storeResets = [resetter(useUiStore), resetter(useLoggedByStore)];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  // Actions POSTed through the default handlers must not leak into the next test.
  resetMockActionStore();
  storeResets.forEach((reset) => reset());
  // After the store reset (a persisted store writes its reset state): nothing stored survives,
  // e.g. the remembered "Logged by" name (T-037). Tests render in English (ADR-009); a test that
  // switches to Vietnamese is undone here.
  window.localStorage.clear();
  await i18n.changeLanguage('en');
});

afterAll(() => server.close());
