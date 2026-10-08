import { AGE_BUCKETS, type AgeBucket } from '@shared/api/vehicles';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/Checkbox';
import { Field } from '@/components/Field';
import { Select } from '@/components/Select';
import { useFilterResetKey } from '../hooks/useFilterResetKey';
import { useInventorySearchParams } from '../hooks/useInventorySearchParams';
import { FILTER_REGION_ID } from '../lib/search-params';
import { AgeRangeFilter } from './AgeRangeFilter';
import { MakeModelFilters } from './MakeModelFilters';
import { MatchCount } from './MatchCount';
import { SearchFilter } from './SearchFilter';

type Props = { dealershipId: number };

const isAgeBucket = (value: string): value is AgeBucket =>
  (AGE_BUCKETS as readonly string[]).includes(value);

/**
 * Inventory filters (US-002): search, make/model, age bucket, aging only and a custom age
 * range, all combined with AND (BR-05). The controls read and write the URL through
 * `useInventorySearchParams`, so they are restored on reload (AC-002.7).
 *
 * Compact so the page stays short (AC-005.4): from `lg`, search, make, model, age bucket and
 * aging only share one row, and the custom range and the match count a second one. Narrower
 * screens wrap the same controls; nothing scrolls horizontally at 768 px.
 */
export function FilterBar({ dealershipId }: Props) {
  const { t } = useTranslation();
  const { query, hasFilters, setFilter, setFilters, setSearch } =
    useInventorySearchParams(dealershipId);
  // "Clear filters" remounts the draft-holding controls, dropping unapplied input (AC-002.8).
  const resetKey = useFilterResetKey();

  return (
    <div
      id={FILTER_REGION_ID}
      role="search"
      aria-label={t('inventory.filters.label')}
      // Programmatic focus target only (after "Clear filters"); not in the tab order.
      tabIndex={-1}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
    >
      {/* Top-aligned: labels line up, and the search hint may hang below its box. */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <SearchFilter
          key={resetKey}
          value={query.q}
          onCommit={setSearch}
          className="w-full sm:w-64 lg:w-48 xl:w-64"
        />
        <MakeModelFilters
          dealershipId={dealershipId}
          make={query.make}
          model={query.model}
          onMakeChange={(make) => setFilter('make', make)}
          onModelChange={(model) => setFilter('model', model)}
        />
        <Field label={t('inventory.filters.ageBucket.label')}>
          {(control) => (
            <Select
              {...control}
              value={query.ageBucket ?? ''}
              onChange={(event) => {
                const { value } = event.target;
                setFilter('ageBucket', isAgeBucket(value) ? value : undefined);
              }}
              className="w-full min-w-40"
            >
              <option value="">{t('inventory.filters.ageBucket.all')}</option>
              {AGE_BUCKETS.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {t(`inventory.filters.ageBucket.options.${bucket}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {/* Shaped like a Field: an invisible label line (same type and gap as the Field labels)
            above a control-height row, so the box lines up with the selects' boxes from the
            same metrics instead of a hard-coded offset. min-h lets a wrapped label grow down. */}
        <div className="flex flex-col gap-1 text-sm">
          <span aria-hidden="true" className="invisible font-medium">
            {'\u00a0'}
          </span>
          <div className="flex min-h-10 items-center">
            <Checkbox
              label={t('inventory.filters.agingOnly')}
              checked={query.agingOnly ?? false}
              // Unchecked means "no restriction" and leaves the URL (TA-27).
              onChange={(event) => setFilter('agingOnly', event.target.checked || undefined)}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <AgeRangeFilter
          key={resetKey}
          minAge={query.minAge}
          maxAge={query.maxAge}
          // Both keys always, so an emptied input removes its bound.
          onApply={({ minAge, maxAge }) => setFilters({ minAge, maxAge })}
        />
        <MatchCount dealershipId={dealershipId} query={query} hasFilters={hasFilters} />
      </div>
    </div>
  );
}
