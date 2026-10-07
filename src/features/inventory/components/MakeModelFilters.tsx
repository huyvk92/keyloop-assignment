import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Select } from '@/components/Select';
import { useFacets } from '../api/inventory.queries';
import { modelOptions, withCurrent } from '../lib/facet-options';

type Props = {
  dealershipId: number;
  make: string | undefined;
  model: string | undefined;
  onMakeChange: (make: string | undefined) => void;
  onModelChange: (model: string | undefined) => void;
};

const selectWidth = 'w-full min-w-40';

/**
 * Make and model selects fed by the dealership's facets (single-select, TA-02). Model options
 * are limited to the selected make; with no make, every model is offered (BR-06). A value from
 * the URL is always shown, even before the facets load (AC-002.7). Make and model are data and
 * are shown as stored (BR-19).
 */
export function MakeModelFilters({
  dealershipId,
  make,
  model,
  onMakeChange,
  onModelChange,
}: Props) {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useFacets(dealershipId);
  const makes = withCurrent(data?.makes.map((facet) => facet.make) ?? [], make);
  const models = withCurrent(modelOptions(data, make), model);
  const busy = isPending || undefined;

  return (
    <>
      <Field label={t('inventory.filters.make.label')}>
        {(control) => (
          <Select
            {...control}
            value={make ?? ''}
            aria-busy={busy}
            onChange={(event) => onMakeChange(event.target.value || undefined)}
            className={selectWidth}
          >
            <option value="">{t('inventory.filters.make.all')}</option>
            {makes.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t('inventory.filters.model.label')}>
        {(control) => (
          <Select
            {...control}
            value={model ?? ''}
            aria-busy={busy}
            onChange={(event) => onModelChange(event.target.value || undefined)}
            className={selectWidth}
          >
            <option value="">{t('inventory.filters.model.all')}</option>
            {models.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {isError && (
        <div role="alert" className="flex items-center gap-2 self-end text-sm text-red-700">
          <span>{t('inventory.filters.facets.error')}</span>
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}
    </>
  );
}
