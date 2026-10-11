import type { Dealership } from '@shared/api/dealerships';
import { useTranslation } from 'react-i18next';
import { useSortControl } from '../hooks/useSortControl';
import { LIST_HEADING_ID } from '../lib/search-params';
import { VehicleTableContent } from './VehicleTableContent';

type Props = {
  dealership: Dealership;
  /** Gives each row a "View <stock number>" button that opens the vehicle (AC-004.4, T-030). */
  onSelectVehicle?: (vehicleId: number) => void;
};

/**
 * The inventory list (US-001): a region named by its always-mounted `<h2>`, so the landmark and
 * the heading stay put across the list's loading, error, empty and success states. The heading is
 * the programmatic focus target of "View all aging vehicles" and of the drawer's focus fallback
 * (TA-11, ADR-006): it is announced as "Vehicle list, heading level 2", and its focus ring shows
 * sighted keyboard users where they are. Inside, the table's keyboard-scrollable container is a
 * named `group`, not a second region, so landmarks are not nested (T-038).
 *
 * Sorting (US-011): the sortable headers write the URL, and a visually hidden polite status says
 * "Sorted by price, ascending" once per user sort change (AC-011.3). It lives here, not in the
 * table, so it is in the document before its text changes. A sort never changes the result
 * count, so the filter bar's match count (the single announcer of result changes) stays silent.
 * The status is keyed by language: a language switch re-renders the text in a new element, which
 * screen readers don't announce.
 */
export function VehicleTable({ dealership, onSelectVehicle }: Props) {
  const { t, i18n } = useTranslation();
  const { sort, order, sortBy, announced } = useSortControl(dealership.id);
  return (
    <section aria-labelledby={LIST_HEADING_ID} className="space-y-3">
      <h2
        id={LIST_HEADING_ID}
        // Programmatic focus target only; not in the tab order.
        tabIndex={-1}
        className="w-fit rounded text-lg font-semibold text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {t('inventory.list.label')}
      </h2>
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
    </section>
  );
}
