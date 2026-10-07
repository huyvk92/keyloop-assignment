import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { useCanonicalSearch } from './useCanonicalSearch';

function setup(initialUrl: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      useCanonicalSearch();
      return { location: useLocation(), navigationType: useNavigationType() };
    },
    { wrapper },
  ).result;
}

describe('useCanonicalSearch', () => {
  it('drops an invalid param and replaces the URL instead of failing (TA-09)', () => {
    const result = setup('/dealerships/1?make=Ford&pageSize=999');

    expect(result.current.location.search).toBe('?make=Ford');
    expect(result.current.navigationType).toBe('REPLACE');
  });

  it('removes default values from a hand-edited URL (TA-09)', () => {
    const result = setup('/dealerships/1?page=1&sort=age&agingOnly=false');

    expect(result.current.location.search).toBe('');
    expect(result.current.navigationType).toBe('REPLACE');
  });

  it('leaves a canonical URL alone', () => {
    const result = setup('/dealerships/1?make=Ford&page=2');

    expect(result.current.location.search).toBe('?make=Ford&page=2');
    expect(result.current.navigationType).toBe('POP');
  });
});
