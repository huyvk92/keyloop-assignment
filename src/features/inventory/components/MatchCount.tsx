import type { VehicleListQuery } from '@shared/api/vehicles';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useFormatters } from '@/lib/use-formatters';
import { useVehicleList } from '../api/inventory.queries';

type Props = {
  dealershipId: number;
  query: VehicleListQuery;
  hasFilters: boolean;
  className?: string;
};

type Shown = {
  text: string;
  /**
   * Visually hidden "Showing 26-50 of 360" after a user page change (Next, Previous, Back); empty
   * otherwise. The visible pagination summary says the same but is not live.
   */
  range: string;
  /** The query the text belongs to; `undefined` while there is no result. */
  forQuery: string | undefined;
  /** The same query without its page, to tell a page change from a filter or sort change. */
  forFilters: string | undefined;
  /** Key of the live region element; a new key replaces the element instead of updating it. */
  region: number;
};

/** The query without its page: equal for two queries that differ only by page. */
const withoutPage = (query: VehicleListQuery) => JSON.stringify({ ...query, page: undefined });

/**
 * Polite live count of the current result (AC-002.1), and the dashboard's single announcer of
 * result changes (the pagination summary and the table hints are not live regions). It reads
 * the list query the table uses (same key, no extra request) and changes text only once a result
 * has settled: while the next result loads the previous text stays, so a filter change is
 * announced once, and keystrokes (debounced, TA-08) announce nothing.
 *
 * A page change keeps the count, so it would be silent; instead the range ("Showing 26-50 of
 * 360") is added as visually hidden text, once the new page has settled (T-038): focus stays on
 * Next/Previous, and this is the only feedback a screen reader user gets that the rows changed.
 *
 * A new text for the same query (a 60 s background poll, ADR-007, or a language switch) is not
 * user-driven, so it is shown in a new region element: screen readers announce changes inside a
 * live region, not a region inserted with its content.
 */
export function MatchCount({ dealershipId, query, hasFilters, className }: Props) {
  const { t } = useTranslation();
  const { integer } = useFormatters();
  const { data, isPlaceholderData } = useVehicleList(dealershipId, query);
  const [shown, setShown] = useState<Shown>({
    text: '',
    range: '',
    forQuery: undefined,
    forFilters: undefined,
    region: 0,
  });

  const forQuery = JSON.stringify(query);
  const forFilters = withoutPage(query);
  const settled: Pick<Shown, 'text' | 'forQuery' | 'forFilters'> | undefined = isPlaceholderData
    ? undefined
    : data
      ? {
          text: t(
            hasFilters
              ? 'inventory.filters.matchCount.filtered'
              : 'inventory.filters.matchCount.all',
            { count: data.total, total: integer(data.total) },
          ),
          forQuery,
          forFilters,
        }
      : { text: '', forQuery: undefined, forFilters: undefined };

  // Adjust state while rendering (React docs pattern): keep the last settled text meanwhile.
  if (settled && (settled.text !== shown.text || settled.forQuery !== shown.forQuery)) {
    const silent =
      settled.text !== '' && settled.forQuery !== undefined && settled.forQuery === shown.forQuery;
    // Only the page differs from the last settled result: a user page change, never a poll.
    const paged =
      data !== undefined &&
      settled.forQuery !== shown.forQuery &&
      settled.forFilters !== undefined &&
      settled.forFilters === shown.forFilters;
    const range = paged
      ? t('inventory.pagination.summary', {
          from: integer(Math.min(data.total, (data.page - 1) * data.pageSize + 1)),
          to: integer(Math.min(data.total, data.page * data.pageSize)),
          total: integer(data.total),
        })
      : '';
    setShown({ ...settled, range, region: silent ? shown.region + 1 : shown.region });
  }

  return (
    <p
      key={shown.region}
      role="status"
      className={cn('min-h-5 text-sm font-medium text-slate-700', className)}
    >
      {shown.text}
      {shown.range && <span className="sr-only"> {shown.range}</span>}
    </p>
  );
}
