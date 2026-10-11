import type { Dealership } from '@shared/api/dealerships';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { useVehicleList } from '../api/inventory.queries';
import { useInventorySearchParams } from '../hooks/useInventorySearchParams';
import { useVehicleExport } from '../hooks/useVehicleExport';

type Props = { dealership: Dealership };

/**
 * "Export CSV" of the filtered list, all pages in the current sort (US-013, ADR-010).
 *
 * - Busy: "Exporting…", `aria-disabled` (not `disabled`), so focus stays on the button and a
 *   second click is ignored, like Refresh and Save (AC-013.2). No status message: the label and
 *   the browser's own download UI are the feedback (single-announcer rule, SDD §5.5).
 * - Failure: the mapped error (never raw text) in a `role="alert"` next to the button, like a
 *   failed save; it is user-initiated and otherwise silent. Focus stays on the button for a retry.
 * - Nothing matches: `aria-disabled` with a description; the list already shows why (empty state
 *   and match count), and a header-only file would be useless. While the list is still loading
 *   the button stays usable: the export does its own requests.
 */
export function ExportButton({ dealership }: Props) {
  const { t } = useTranslation();
  const emptyHintId = useId();
  const { query } = useInventorySearchParams(dealership.id);
  // Same key as the table and the match count: no extra request.
  const { data, isPlaceholderData } = useVehicleList(dealership.id, query);
  const { state, start } = useVehicleExport(dealership);
  const isExporting = state.status === 'exporting';
  const isEmpty = !isExporting && !isPlaceholderData && data?.total === 0;

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-red-700">
          {t('inventory.export.error')} {getErrorMessage(state.error, t)}
        </p>
      )}
      <Button
        variant="secondary"
        size="sm"
        isLoading={isExporting}
        onClick={() => {
          if (!isEmpty) void start();
        }}
        {...(isEmpty && { 'aria-disabled': true, 'aria-describedby': emptyHintId })}
      >
        {isExporting ? t('inventory.export.exporting') : t('inventory.export.button')}
      </Button>
      {isEmpty && (
        <span id={emptyHintId} className="sr-only">
          {t('inventory.export.empty')}
        </span>
      )}
    </div>
  );
}
