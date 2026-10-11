import { useCallback, useContext } from 'react';
import { UNSAFE_DataRouterContext, UNSAFE_NavigationContext, useLocation } from 'react-router';

type WithLocation = { location: { search: string } };

const hasLocation = (navigator: object): navigator is WithLocation =>
  'location' in navigator &&
  typeof navigator.location === 'object' &&
  navigator.location !== null &&
  'search' in navigator.location &&
  typeof navigator.location.search === 'string';

/**
 * Returns a function that reads the router's search string *now* (with `?`), not as of the last
 * render. React Router updates its location synchronously on `navigate()` but React re-renders
 * later (a transition: 100-250 ms in Chrome under load), so a URL write built from the rendered
 * location would drop a write made in between (Phase 6 bug: Make, then Days in stock, lost Make).
 *
 * Reads the data router's state (the app and the tests use one), else the history behind a
 * `<MemoryRouter>`/`<BrowserRouter>` (hook tests, Storybook), else the rendered location.
 * `UNSAFE_*` contexts are React Router's public escape hatch for this; there is no other API that
 * exposes the pending location.
 */
export function useLatestSearch(): () => string {
  const dataRouter = useContext(UNSAFE_DataRouterContext);
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const rendered = useLocation().search;
  return useCallback(() => {
    if (dataRouter) return dataRouter.router.state.location.search;
    return hasLocation(navigator) ? navigator.location.search : rendered;
  }, [dataRouter, navigator, rendered]);
}
