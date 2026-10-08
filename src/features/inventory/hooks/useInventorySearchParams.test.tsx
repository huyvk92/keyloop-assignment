import type { FacetsResponse } from '@shared/api/vehicles';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router';
import { inventoryKeys } from '@/features/inventory';
import { createTestQueryClient } from '@/test/render';
import { isFiltersClearedState } from '../lib/search-params';
import { useInventorySearchParams } from './useInventorySearchParams';

function setup(initialUrl: string, queryClient: QueryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route path="/dealerships/:dealershipId" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return renderHook(
    () => ({
      ...useInventorySearchParams(1),
      location: useLocation(),
      navigationType: useNavigationType(),
    }),
    { wrapper },
  ).result;
}

function withFacets(facets: FacetsResponse) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(inventoryKeys.facets(1), facets);
  return queryClient;
}

describe('useInventorySearchParams', () => {
  it('parses filters and page from the URL into the typed query (AC-002.7)', () => {
    const result = setup('/dealerships/1?make=Ford&page=2');

    expect(result.current.query).toMatchObject({ make: 'Ford', page: 2, sort: 'age' });
    expect(result.current.hasFilters).toBe(true);
    expect(result.current.navigationType).toBe('POP');
  });

  it('ignores an invalid param without navigating; useCanonicalSearch cleans the URL (TA-09)', () => {
    const result = setup('/dealerships/1?make=Ford&pageSize=999');

    expect(result.current.query).toMatchObject({ make: 'Ford', pageSize: 25 });
    expect(result.current.location.search).toBe('?make=Ford&pageSize=999');
    expect(result.current.navigationType).toBe('POP');
  });

  it('writes canonical URLs: no defaults, invalid params dropped', () => {
    const result = setup('/dealerships/1?page=1&sort=age&agingOnly=false&pageSize=999');

    act(() => result.current.setFilter('make', 'Ford'));

    expect(result.current.location.search).toBe('?make=Ford');
  });

  it('pushes the first search, replaces refinements and pushes clearing it (TA-28)', () => {
    const result = setup('/dealerships/1?make=Ford&page=2');

    act(() => result.current.setSearch('stk'));
    expect(result.current.location.search).toBe('?make=Ford&q=stk');
    expect(result.current.navigationType).toBe('PUSH');

    act(() => result.current.setSearch('stk-1'));
    expect(result.current.location.search).toBe('?make=Ford&q=stk-1');
    expect(result.current.navigationType).toBe('REPLACE');

    act(() => result.current.setSearch(undefined));
    expect(result.current.location.search).toBe('?make=Ford');
    expect(result.current.navigationType).toBe('PUSH');
  });

  it('resets the page to 1 on a filter change and pushes a history entry', () => {
    const result = setup('/dealerships/1?sort=price&page=3');

    act(() => result.current.setFilter('agingOnly', true));

    expect(result.current.location.search).toBe('?agingOnly=true&sort=price');
    expect(result.current.navigationType).toBe('PUSH');
    expect(result.current.query.page).toBe(1);

    act(() => result.current.setFilter('agingOnly', false));
    expect(result.current.location.search).toBe('?sort=price');
  });

  it('applies several filters at once (custom age range)', () => {
    const result = setup('/dealerships/1?page=2');

    act(() => result.current.setFilters({ minAge: 45, maxAge: 90 }));

    expect(result.current.location.search).toBe('?minAge=45&maxAge=90');
  });

  it('clears model=Focus when the make changes to Toyota (BR-06, AC-002.2)', () => {
    const result = setup(
      '/dealerships/1?make=Ford&model=Focus',
      withFacets({
        makes: [
          { make: 'Ford', models: ['Fiesta', 'Focus'] },
          { make: 'Toyota', models: ['Corolla'] },
        ],
      }),
    );

    act(() => result.current.setFilter('make', 'Toyota'));

    expect(result.current.location.search).toBe('?make=Toyota');
  });

  it('keeps a model the new make also has, and keeps it when the make is cleared (BR-06)', () => {
    const result = setup(
      '/dealerships/1?make=Mini&model=Cooper',
      withFacets({
        makes: [
          { make: 'Mini', models: ['Cooper'] },
          { make: 'Morris', models: ['Cooper'] },
        ],
      }),
    );

    act(() => result.current.setFilter('make', 'Morris'));
    expect(result.current.location.search).toBe('?make=Morris&model=Cooper');

    act(() => result.current.setFilter('make', undefined));
    expect(result.current.location.search).toBe('?model=Cooper');
  });

  it('clears the model on a make change when the facets are not loaded yet (BR-06)', () => {
    const result = setup('/dealerships/1?make=Ford&model=Focus');

    act(() => result.current.setFilter('make', 'Toyota'));

    expect(result.current.location.search).toBe('?make=Toyota');
  });

  it('clearFilters keeps the dealership path and the sort, and drops filters and page (AC-002.8)', () => {
    const result = setup('/dealerships/1?make=Ford&q=stk&sort=price&order=desc&page=3');

    act(() => result.current.clearFilters());

    expect(result.current.location.pathname).toBe('/dealerships/1');
    expect(result.current.location.search).toBe('?sort=price&order=desc');
    expect(result.current.hasFilters).toBe(false);
    // Marks the entry so the filter bar drops unapplied drafts (AC-002.8).
    expect(isFiltersClearedState(result.current.location.state)).toBe(true);
  });

  it('replaceFilters keeps only the given filters, resets sort and page, keeps the page size (TA-29)', () => {
    const result = setup(
      '/dealerships/1?make=Ford&model=Focus&q=stk&minAge=10&sort=price&order=desc&page=2&pageSize=50',
    );

    act(() => result.current.replaceFilters({ agingOnly: true }));

    expect(result.current.location.pathname).toBe('/dealerships/1');
    expect(result.current.location.search).toBe('?agingOnly=true&pageSize=50');
    expect(result.current.navigationType).toBe('PUSH');
    // Drafts (search, age range) are dropped like on Clear filters.
    expect(isFiltersClearedState(result.current.location.state)).toBe(true);
  });

  it('sets the sort (back to page 1) and the page, leaving defaults out of the URL', () => {
    const result = setup('/dealerships/1?make=Ford&page=3');

    act(() => result.current.setSort('price', 'desc'));
    expect(result.current.location.search).toBe('?make=Ford&sort=price&order=desc');

    act(() => result.current.setPage(2));
    expect(result.current.location.search).toBe('?make=Ford&sort=price&order=desc&page=2');

    act(() => result.current.setPage(1, { replace: true }));
    expect(result.current.location.search).toBe('?make=Ford&sort=price&order=desc');
    expect(result.current.navigationType).toBe('REPLACE');
    expect(result.current.searchFor(4)).toBe('?make=Ford&sort=price&order=desc&page=4');
  });

  describe('writes made before the router re-renders (Phase 6 bug: lost first filter)', () => {
    // React Router updates the URL before React re-renders with it (100-250 ms in Chrome). Two
    // writes in one tick reproduce that window deterministically: the second must build on the
    // first, not on the query of the last render.
    it('keeps both of two filter changes', () => {
      const result = setup('/dealerships/1');

      act(() => {
        result.current.setFilter('make', 'Ford');
        result.current.setFilter('ageBucket', 'over-90');
      });

      expect(result.current.location.search).toBe('?make=Ford&ageBucket=over-90');
    });

    it('builds every writer on the latest URL: sort, page, search, range', () => {
      const result = setup('/dealerships/1?make=Ford');

      act(() => {
        result.current.setSort('price', 'desc');
        result.current.setPage(2);
      });
      expect(result.current.location.search).toBe('?make=Ford&sort=price&order=desc&page=2');

      act(() => {
        result.current.setSearch('stk');
        result.current.setFilters({ minAge: 10, maxAge: 20 });
      });
      expect(result.current.location.search).toBe(
        '?make=Ford&minAge=10&maxAge=20&q=stk&sort=price&order=desc',
      );
    });

    it('refines a search committed in the same tick with replace (TA-28)', () => {
      const result = setup('/dealerships/1');

      act(() => {
        result.current.setSearch('st');
        result.current.setSearch('stk');
      });

      expect(result.current.location.search).toBe('?q=stk');
      expect(result.current.navigationType).toBe('REPLACE');
    });

    it('keeps the sort and page size for Clear filters and View all after a pending write', () => {
      const result = setup('/dealerships/1?make=Ford&pageSize=50');

      act(() => {
        result.current.setSort('price');
        result.current.clearFilters();
      });
      expect(result.current.location.search).toBe('?sort=price&pageSize=50');

      act(() => {
        result.current.setFilter('make', 'Ford');
        result.current.replaceFilters({ agingOnly: true });
      });
      expect(result.current.location.search).toBe('?agingOnly=true&pageSize=50');
    });
  });
});
