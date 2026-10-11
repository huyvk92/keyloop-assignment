import type { VehicleListItem } from '@shared/api/vehicles';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useFormatters } from '@/lib/use-formatters';
import { AttentionBadge } from './AttentionBadge';

type Props = {
  vehicles: VehicleListItem[];
  /** Makes each item a button that opens the vehicle (AC-004.4); without it items are plain text. */
  onSelectVehicle?: (vehicleId: number) => void;
};

const row = 'flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 px-2 py-1.5 text-left text-sm';

/**
 * Compact list of aging vehicles in the API's order (oldest first, BR-17): stock number,
 * make/model, days in stock and current action (BR-14), plus a "Needs attention" text label when
 * there is no action (BR-16, AC-010.1). Two columns from `lg`, filled top to
 * bottom so the reading order stays oldest first; keeps the section short so the KPIs and the
 * list stay near the fold (AC-005.4). Vehicle data is shown as stored; only the action status
 * label is translated (BR-19).
 */
export function AgingList({ vehicles, onSelectVehicle }: Props) {
  const { t } = useTranslation();
  const { integer } = useFormatters();
  return (
    <ol aria-label={t('inventory.aging.listLabel')} className="gap-x-6 lg:columns-2">
      {vehicles.map((v) => {
        const name = `${v.make} ${v.model}`;
        const content = (
          <>
            <span className="w-20 shrink-0 font-medium tabular-nums">{v.stockNumber}</span>
            {/* One line with an ellipsis so long names ("Land Rover Range Rover Evoque") keep rows
                the same height; the clipping is visual only (screen readers get the full text) and
                `title` shows the full name on hover. */}
            <span className="min-w-0 flex-1 truncate" title={name}>
              {name}
            </span>
            <span className="shrink-0 text-right tabular-nums">
              {t('inventory.aging.days', { count: v.daysInStock, days: integer(v.daysInStock) })}
            </span>
            <span
              className={cn(
                'flex w-full shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 sm:w-60 sm:justify-end',
                v.currentAction ? 'font-medium text-slate-900' : 'text-slate-600',
              )}
            >
              {v.currentAction
                ? t(`actionStatus.${v.currentAction.status}`)
                : t('inventory.table.noAction')}
              {v.needsAttention && <AttentionBadge />}
            </span>
          </>
        );
        return (
          <li key={v.id} className="break-inside-avoid border-b border-slate-100">
            {onSelectVehicle ? (
              <button
                type="button"
                onClick={() => onSelectVehicle(v.id)}
                className={cn(
                  row,
                  'rounded hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none',
                )}
              >
                {content}
              </button>
            ) : (
              <div className={row}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
