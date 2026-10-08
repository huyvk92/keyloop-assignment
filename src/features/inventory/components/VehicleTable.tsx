import type { Dealership } from '@shared/api/dealerships';
import { useTranslation } from 'react-i18next';
import { LIST_REGION_ID } from '../lib/search-params';
import { VehicleTableContent } from './VehicleTableContent';

type Props = { dealership: Dealership };

/**
 * The inventory list (US-001) inside a labelled region that stays mounted across its loading,
 * error, empty and success states, so other controls (e.g. "View all aging vehicles", TA-11) can
 * move focus to the results while they load.
 */
export function VehicleTable({ dealership }: Props) {
  const { t } = useTranslation();
  return (
    <div
      id={LIST_REGION_ID}
      role="region"
      aria-label={t('inventory.list.label')}
      // Programmatic focus target only; not in the tab order.
      tabIndex={-1}
      className="rounded-lg focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <VehicleTableContent dealership={dealership} />
    </div>
  );
}
