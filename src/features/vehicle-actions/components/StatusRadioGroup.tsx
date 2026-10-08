import { ACTION_STATUSES } from '@shared/api/actions';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { cn } from '@/lib/cn';

type Props = {
  /** `register('status')` from the form. */
  registration: UseFormRegisterReturn<'status'>;
  /** Translated validation message; marks the group invalid and describes it. */
  error?: string;
};

/**
 * The five action statuses as one radio group, all visible, in ACTION_STATUSES order (TA-20,
 * AC-006.1). Values are the canonical statuses (sent to the API as is); only the labels are
 * translated (BR-19). The legend names the group and the error describes it.
 */
export function StatusRadioGroup({ registration, error }: Props) {
  const { t } = useTranslation();
  const errorId = useId();
  return (
    <fieldset
      // A fieldset is a "group"; radiogroup tells assistive tech that one option is chosen.
      role="radiogroup"
      aria-required="true"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className="space-y-2 text-sm"
    >
      <legend className="mb-1 font-medium text-slate-700">{t('vehicleActions.form.status')}</legend>
      <div className="grid gap-1 sm:grid-cols-2">
        {ACTION_STATUSES.map((status) => (
          <label
            key={status}
            className={cn(
              'flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-slate-900',
              'has-checked:border-brand-600 has-checked:bg-brand-50',
              error && 'border-red-300',
            )}
          >
            <input
              type="radio"
              value={status}
              {...registration}
              className="size-4 accent-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            {t(`actionStatus.${status}`)}
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="font-medium text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
