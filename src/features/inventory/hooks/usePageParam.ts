import { VehicleListQuerySchema } from '@shared/api/vehicles';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

const PageSchema = VehicleListQuerySchema.shape.page;
const FIRST_PAGE = 1;

function withPage(current: URLSearchParams, page: number): URLSearchParams {
  const next = new URLSearchParams(current);
  // Defaults stay out of the URL (TA-09).
  if (page <= FIRST_PAGE) next.delete('page');
  else next.set('page', String(page));
  return next;
}

/**
 * The list page in `?page=N`, validated with the shared contract; an invalid value reads as 1.
 * Minimal URL state for T-011; T-018's `useInventorySearchParams` supersedes it.
 */
export function usePageParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const parsed = PageSchema.safeParse(searchParams.get('page') ?? undefined);
  const page = parsed.success ? parsed.data : FIRST_PAGE;

  const setPage = useCallback(
    (nextPage: number, { replace = false }: { replace?: boolean } = {}) =>
      setSearchParams((current) => withPage(current, nextPage), { replace }),
    [setSearchParams],
  );

  /** `?search` for a page, keeping the other params (for `<Navigate>`). */
  const searchFor = (targetPage: number) => {
    const search = withPage(searchParams, targetPage).toString();
    return search ? `?${search}` : '';
  };

  return { page, setPage, searchFor };
}
