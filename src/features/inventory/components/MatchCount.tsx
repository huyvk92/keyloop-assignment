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
  /** The query the text belongs to; `undefined` while there is no result. */
  forQuery: string | undefined;
  /** Key of the live region element; a new key replaces the element instead of updating it. */
  region: number;
};

/**
 * Polite live count of the current result (AC-002.1), and the dashboard's single announcer of
 * result changes (the pagination summary and the table hints are not live regions). It reads
 * the list query the table uses (same key, no extra request) and changes text only once a result
 * has settled: while the next result loads the previous text stays, so a filter change is
 * announced once, and keystrokes (debounced, TA-08) announce nothing.
 *
 * A new text for the same query (a 60 s background poll, ADR-007, or a language switch) is not
 * user-driven, so it is shown in a new region element: screen readers announce changes inside a
 * live region, not a region inserted with its content.
 */
export function MatchCount({ dealershipId, query, hasFilters, className }: Props) {
  const { t } = useTranslation();
  const { integer } = useFormatters();
  const { data, isPlaceholderData } = useVehicleList(dealershipId, query);
  const [shown, setShown] = useState<Shown>({ text: '', forQuery: undefined, region: 0 });

  const forQuery = JSON.stringify(query);
  const settled: Omit<Shown, 'region'> | undefined = isPlaceholderData
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
        }
      : { text: '', forQuery: undefined };

  // Adjust state while rendering (React docs pattern): keep the last settled text meanwhile.
  if (settled && (settled.text !== shown.text || settled.forQuery !== shown.forQuery)) {
    const silent =
      settled.text !== '' && settled.forQuery !== undefined && settled.forQuery === shown.forQuery;
    setShown({ ...settled, region: silent ? shown.region + 1 : shown.region });
  }

  return (
    <p
      key={shown.region}
      role="status"
      className={cn('min-h-5 text-sm font-medium text-slate-700', className)}
    >
      {shown.text}
    </p>
  );
}
