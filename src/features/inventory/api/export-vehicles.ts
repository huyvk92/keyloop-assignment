import { PAGE_SIZE_MAX, type VehicleListItem, type VehicleListQuery } from '@shared/api/vehicles';
import { getVehicles } from './inventory.api';

/** The list contract's largest page (ADR-010: no new API surface, no larger pages). */
export const EXPORT_PAGE_SIZE = PAGE_SIZE_MAX;
/** Pages fetched at the same time after the first: 5,000 vehicles = 50 requests, 4 at a time. */
export const EXPORT_CONCURRENCY = 4;

type Options = {
  /** Aborting (leaving the page or the dealership) cancels every pending request. */
  signal?: AbortSignal;
  concurrency?: number;
};

/**
 * Every vehicle matching `query`'s filters, in its sort order, for the CSV export (ADR-010,
 * AC-013.1). Page 1 (`pageSize=100`) gives the total; the remaining pages are fetched with
 * bounded concurrency and put back in page order. Each page is parsed with
 * `VehicleListResponseSchema` (`getVehicles`). The query's own page and page size are ignored.
 *
 * All or nothing (AC-013.2): the first failed page aborts the others and rejects, so no partial
 * list reaches the file. A row whose filter membership changes during the export may be repeated
 * or missed (TA-34, accepted).
 */
export async function fetchAllVehicles(
  dealershipId: number,
  query: VehicleListQuery,
  { signal, concurrency = EXPORT_CONCURRENCY }: Options = {},
): Promise<VehicleListItem[]> {
  signal?.throwIfAborted();
  // Own controller: aborted by the caller's signal or by the first failure.
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });

  const fetchPage = (page: number) =>
    getVehicles(dealershipId, { ...query, page, pageSize: EXPORT_PAGE_SIZE }, controller.signal);

  try {
    const first = await fetchPage(1);
    const pageCount = Math.max(1, Math.ceil(first.total / EXPORT_PAGE_SIZE));
    const pages: VehicleListItem[][] = [first.items];

    let nextPage = 2;
    const worker = async () => {
      while (nextPage <= pageCount) {
        const page = nextPage;
        nextPage += 1;
        pages[page - 1] = (await fetchPage(page)).items;
      }
    };
    const workers = Array.from({ length: Math.min(concurrency, pageCount - 1) }, worker);
    try {
      await Promise.all(workers);
    } catch (error) {
      controller.abort();
      throw error;
    }
    return pages.flat();
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}
