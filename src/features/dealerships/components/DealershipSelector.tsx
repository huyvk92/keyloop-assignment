import { DealershipParamsSchema } from '@shared/api/dealerships';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Field } from '@/components/Field';
import { Select } from '@/components/Select';
import { KEEP_FOCUS_STATE } from '@/lib/navigation-focus';
import { useDealerships } from '../api/dealerships.queries';

type Props = {
  /** The dealership in the URL path (ADR-008): the selector reflects it, never stores it. */
  dealershipId: number;
  className?: string;
};

/**
 * Page-level dealership switcher (US-008). Choosing another dealership pushes
 * `/dealerships/:id` with no search params, so filters, sort and page reset (AC-008.2, TA-10)
 * and Back returns to the previous dealership with its filters. The URL stays the only source
 * of the selection, so reload and share keep it (AC-008.3). Focus stays on the select.
 */
export function DealershipSelector({ dealershipId, className }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isPending, isError } = useDealerships();

  // The page renders the dealerships error (with Retry); a broken selector adds nothing.
  if (isError) return null;

  return (
    <Field
      label={t('dealerships.selector.label')}
      layout="inline"
      className={className}
      labelClassName="text-slate-600"
    >
      {(control) => (
        <Select
          {...control}
          value={String(dealershipId)}
          disabled={isPending}
          aria-busy={isPending || undefined}
          onChange={(event) => {
            const parsed = DealershipParamsSchema.safeParse({ dealershipId: event.target.value });
            if (!parsed.success) return;
            void navigate(`/dealerships/${parsed.data.dealershipId}`, { state: KEEP_FOCUS_STATE });
          }}
          className="min-w-40"
        >
          {isPending ? (
            <option value={String(dealershipId)}>{t('dealerships.loadingList')}</option>
          ) : (
            data.items.map((dealership) => (
              <option key={dealership.id} value={String(dealership.id)}>
                {dealership.name}
              </option>
            ))
          )}
        </Select>
      )}
    </Field>
  );
}
