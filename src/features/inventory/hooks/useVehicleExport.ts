import type { Dealership } from '@shared/api/dealerships';
import type { InventorySummary } from '@shared/api/vehicles';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadText } from '@/lib/download';
import { fetchAllVehicles } from '../api/export-vehicles';
import { inventoryKeys } from '../api/inventory.queries';
import { exportFileName, todayIn, vehiclesToCsv } from '../lib/vehicle-csv';
import { useInventorySearchParams } from './useInventorySearchParams';

export type ExportState =
  { status: 'idle' } | { status: 'exporting' } | { status: 'error'; error: unknown };

/**
 * Runs the CSV export of the current list (US-013, ADR-010): every page of the current filters
 * and sort, read from the router's latest URL at click time (TA-33), built into a CSV in the UI
 * language at the time the data arrives, then downloaded.
 *
 * - One export at a time (AC-013.2): a second `start` while one runs does nothing.
 * - All or nothing: any failed page leaves `status: 'error'` and nothing is downloaded.
 * - Unmounting (leaving the page; the filter bar is keyed by dealership, so also a dealership
 *   switch) aborts the pending requests and drops the result.
 *
 * Local state rather than a TanStack mutation: nothing is cached or shared, and the export needs
 * an abort tied to the component's lifetime, which `useMutation` doesn't offer.
 */
export function useVehicleExport(dealership: Dealership) {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { latestQuery } = useInventorySearchParams(dealership.id);
  const [state, setState] = useState<ExportState>({ status: 'idle' });
  const running = useRef(false);
  // One controller per mount (StrictMode mounts twice; each mount gets its own).
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);

  const start = useCallback(async () => {
    const signal = lifetime.current?.signal;
    if (running.current || !signal || signal.aborted) return;
    running.current = true;
    setState({ status: 'exporting' });
    try {
      const vehicles = await fetchAllVehicles(dealership.id, latestQuery(), { signal });
      // `i18n.t` is the current language now, even if it changed while the pages loaded.
      const csv = vehiclesToCsv(vehicles, { t: i18n.t, currency: dealership.currency });
      // The summary's dealership-local "today" (TA-01) when loaded, else the dealership's clock.
      const asOfDate = queryClient.getQueryData<InventorySummary>(
        inventoryKeys.summary(dealership.id),
      )?.asOfDate;
      downloadText(
        csv,
        exportFileName(dealership, asOfDate ?? todayIn(dealership.timeZone)),
        'text/csv;charset=utf-8',
      );
      setState({ status: 'idle' });
    } catch (error) {
      // Unmounted: nothing to show, and no file.
      if (!signal.aborted) setState({ status: 'error', error });
    } finally {
      running.current = false;
    }
  }, [dealership, i18n, latestQuery, queryClient]);

  return { state, start };
}
