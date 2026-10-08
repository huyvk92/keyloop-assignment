import type { Dealership } from '@shared/api/dealerships';
import { useTranslation } from 'react-i18next';
import { useSortControl } from '../hooks/useSortControl';
import { LIST_REGION_ID } from '../lib/search-params';
import { VehicleTableContent } from './VehicleTableContent';

type Props = {
  dealership: Dealership;
  /** Gives each row a "View <stock number>" button that opens the vehicle (AC-004.4, T-030). */
  onSelectVehicle?: (vehicleId: number) => void;
};

/**
 * The inventory list (US-001) inside a labelled region that stays mounted across its loading,
 * error, empty and success states, so other controls (e.g. "View all aging vehicles", TA-11) can
 * move focus to the results while they load.
 *
 * Sorting (US-011): the sortable headers write the URL, and a visually hidden polite status says
 * "Sorted by price, ascending" once per user sort change (AC-011.3). It lives here, not in the
 * table, so it is in the document before its text changes. A sort never changes the result
 * count, so the filter bar's match count (the single announcer of result changes) stays silent.
 * The region is keyed by language: a language switch re-renders the text in a new element, which
 * screen readers don't announce.
 */
export function VehicleTable({ dealership, onSelectVehicle }: Props) {
  const { t, i18n } = useTranslation();
  const { sort, order, sortBy, announced } = useSortControl(dealership.id);
  return (
    <div
      id={LIST_REGION_ID}
      role="region"
      aria-label={t('inventory.list.label')}
      // Programmatic focus target only; not in the tab order.
      tabIndex={-1}
      className="rounded-lg focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <p key={i18n.language} role="status" className="sr-only">
        {announced
          ? t('inventory.sort.announcement', {
              column: t(`inventory.sort.keys.${announced.sort}`),
              order: t(`inventory.sort.orders.${announced.order}`),
            })
          : ''}
      </p>
      <VehicleTableContent
        dealership={dealership}
        onSelectVehicle={onSelectVehicle}
        sorting={{ sort, order, onSort: sortBy }}
      />
    </div>
  );
}
