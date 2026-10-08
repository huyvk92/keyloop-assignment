import type { ActionEntry } from '@shared/api/actions';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/lib/use-formatters';

type Props = {
  /** Newest first, as the API returns them (BR-13). */
  actions: ActionEntry[];
  /** The dealership's time zone: timestamps are dealership-local (TA-12). */
  timeZone: string;
};

/**
 * Read-only, append-only history (US-007): status label, timestamp, "Logged by" and note per
 * entry, with no edit or delete controls (AC-007.6). Notes and names are data, rendered as React
 * text so markup like `<b>cut</b>` shows literally (AC-006.8, NFR-03).
 */
export function ActionHistory({ actions, timeZone }: Props) {
  const { t } = useTranslation();
  const format = useFormatters();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h3 id={headingId} className="text-base font-semibold text-slate-900">
        {t('vehicleActions.history.title')}
      </h3>
      {actions.length === 0 ? (
        <p className="text-sm text-slate-600">{t('vehicleActions.history.empty')}</p>
      ) : (
        <ol aria-label={t('vehicleActions.history.label')} className="space-y-2">
          {actions.map((entry) => (
            <li key={entry.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-medium text-slate-900">
                  {t(`actionStatus.${entry.status}`)}
                </span>
                <time dateTime={entry.loggedAt} className="text-slate-600 tabular-nums">
                  {format.dateTime(entry.loggedAt, timeZone)}
                </time>
              </div>
              <p className="text-slate-600">
                {t('vehicleActions.history.loggedBy', { name: entry.loggedBy })}
              </p>
              {entry.note && (
                <p className="mt-2 break-words whitespace-pre-wrap text-slate-900">{entry.note}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
