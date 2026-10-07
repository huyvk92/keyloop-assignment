import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { usePageParam } from './usePageParam';

function setup(initialUrl: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => ({ ...usePageParam(), location: useLocation(), navigationType: useNavigationType() }),
    { wrapper },
  ).result;
}

describe('usePageParam', () => {
  it.each([
    ['/x', 1],
    ['/x?page=3', 3],
    ['/x?page=0', 1],
    ['/x?page=abc', 1],
  ])('reads %s as page %i', (url, page) => {
    expect(setup(url).current.page).toBe(page);
  });

  it('writes the page to the URL, keeps other params, and omits the default (TA-09)', () => {
    const result = setup('/x?sort=price');

    act(() => result.current.setPage(2));
    expect(result.current.location.search).toBe('?sort=price&page=2');
    expect(result.current.navigationType).toBe('PUSH');

    act(() => result.current.setPage(1));
    expect(result.current.location.search).toBe('?sort=price');
  });

  it('can replace the history entry instead of pushing', () => {
    const result = setup('/x?page=9');

    act(() => result.current.setPage(2, { replace: true }));
    expect(result.current.navigationType).toBe('REPLACE');
    expect(result.current.location.search).toBe('?page=2');
  });
});
