import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/ErrorState';
import { useFormatters } from '@/lib/use-formatters';
import { useInventorySummary } from '../api/inventory.queries';

type Props = { dealershipId: number };

type Kpi = { key: string; label: string; value: ReactNode };

/**
 * KPI summary (US-005, US-010): Total vehicles, Aging, % aging, Average days in stock and Needs
 * attention over the dealership's whole stock, never the filtered list (BR-15, BR-16, AC-005.2).
 * A `<dl>` of compact cards at the top of the page, so it is visible without scrolling at
 * 1280x800 (AC-005.4): the five cards share one row from `lg` (2 then 3 columns below; in 2
 * columns the last card spans the row).
 *
 * States: loading (labels with skeleton values, `aria-busy`, one visually hidden "Loading…" for
 * the section), error with Retry (only when nothing has loaded), success. A failed background
 * refresh keeps the last values and shows a quiet hint, like the list. Adds no status region:
 * the filter bar's match count is the single announcer of result changes.
 */
export function KpiCards({ dealershipId }: Props) {
  const { t } = useTranslation();
  const { integer, percent } = useFormatters();
  const id = useId();
  const { data, error, isPending, refetch } = useInventorySummary(dealershipId);

  const kpis: Kpi[] = [
    { key: 'total', label: t('inventory.kpis.total'), value: data && integer(data.totalVehicles) },
    { key: 'aging', label: t('inventory.kpis.aging'), value: data && integer(data.agingCount) },
    {
      key: 'agingPercent',
      label: t('inventory.kpis.agingPercent'),
      value: data && percent(data.agingPercent),
    },
    {
      key: 'averageDays',
      label: t('inventory.kpis.averageDays'),
      value:
        data &&
        (data.averageDaysInStock === null ? (
          // No vehicles (AC-005.3): "-" on screen, words for screen readers.
          <>
            <span aria-hidden="true">-</span>
            <span className="sr-only">{t('inventory.kpis.noValue')}</span>
          </>
        ) : (
          integer(data.averageDaysInStock)
        )),
    },
    {
      key: 'needsAttention',
      label: t('inventory.kpis.needsAttention'),
      value: data && integer(data.needsAttentionCount),
    },
  ];

  return (
    <section aria-labelledby={`${id}-title`} aria-busy={isPending || undefined}>
      <h2 id={`${id}-title`} className="sr-only">
        {t('inventory.kpis.title')}
      </h2>
      {/* Said once for the section, not per value; not a live region (see above). */}
      {isPending && <p className="sr-only">{t('common.loading')}</p>}
      {!isPending && !data ? (
        <ErrorState
          error={error}
          title={t('inventory.kpis.loadError')}
          onRetry={() => void refetch()}
        />
      ) : (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((kpi) => (
            // Column + space-between: values line up even when a (translated) label wraps. Below
            // `sm` (2 columns) the fifth card spans the row instead of sitting alone in half of it.
            <div
              key={kpi.key}
              className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 max-sm:last:col-span-2"
            >
              <dt id={`${id}-${kpi.key}`} className="text-sm font-medium text-slate-600">
                {kpi.label}
              </dt>
              {/* Named by its term, so the value can be found by role and label. */}
              <dd
                aria-labelledby={`${id}-${kpi.key}`}
                className="mt-1 min-h-8 text-2xl font-semibold text-slate-900 tabular-nums"
              >
                {kpi.value ?? (
                  <span
                    aria-hidden="true"
                    className="block h-8 w-16 animate-pulse rounded bg-slate-200 motion-reduce:animate-none"
                  />
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {/* A visible hint only, like the list's: a failed background refresh keeps the values. */}
      {error && data && (
        <p className="mt-2 text-sm text-slate-600">{t('inventory.kpis.refreshFailed')}</p>
      )}
    </section>
  );
}
