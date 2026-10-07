import { zodResolver } from '@hookform/resolvers/zod';
import {
  AGE_RANGE_ERROR_MESSAGE,
  AgeRangeFormSchema,
  MAX_AGE_DAYS,
  type AgeRangeForm,
  type AgeRangeFormInput,
} from '@shared/api/vehicles';
import { useForm, type FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { TextInput } from '@/components/TextInput';
import { useFormatters } from '@/lib/use-formatters';

type Props = {
  /**
   * Applied bounds from the URL; the form follows them when they change (Back, a shared link).
   * "Clear filters" also drops an unapplied draft: the parent remounts this form (`key`).
   */
  minAge: number | undefined;
  maxAge: number | undefined;
  onApply: (range: AgeRangeForm) => void;
  className?: string;
};

const toText = (value: number | undefined) => (value === undefined ? '' : String(value));

/**
 * Custom inclusive min-max age range (BR-07, AC-002.4). Validated with the shared
 * `AgeRangeFormSchema` on Apply: an invalid range shows an inline error linked to its input and
 * nothing is applied. An empty input means "no bound".
 */
export function AgeRangeFilter({ minAge, maxAge, onApply, className }: Props) {
  const { t } = useTranslation();
  const { integer } = useFormatters();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AgeRangeFormInput, unknown, AgeRangeForm>({
    resolver: zodResolver(AgeRangeFormSchema),
    values: { minAge: toText(minAge), maxAge: toText(maxAge) },
  });

  // The contract's messages are English; show translated text, never the raw message (BR-19).
  const errorText = (error: FieldError | undefined) => {
    if (!error) return undefined;
    if (error.message === AGE_RANGE_ERROR_MESSAGE)
      return t('inventory.filters.ageRange.errors.order');
    return t('inventory.filters.ageRange.errors.invalid', { max: integer(MAX_AGE_DAYS) });
  };

  return (
    <form
      noValidate
      className={className}
      onSubmit={(event) =>
        void handleSubmit((range) => {
          if (range.minAge !== minAge || range.maxAge !== maxAge) onApply(range);
        })(event)
      }
    >
      <fieldset className="flex flex-wrap items-start gap-3">
        <legend className="mb-1 text-sm font-medium text-slate-700">
          {t('inventory.filters.ageRange.legend')}
        </legend>
        <Field
          label={t('inventory.filters.ageRange.min')}
          error={errorText(errors.minAge)}
          className="w-40"
        >
          {(control) => <TextInput {...control} inputMode="numeric" {...register('minAge')} />}
        </Field>
        <Field
          label={t('inventory.filters.ageRange.max')}
          error={errorText(errors.maxAge)}
          className="w-40"
        >
          {(control) => <TextInput {...control} inputMode="numeric" {...register('maxAge')} />}
        </Field>
        <Button type="submit" variant="secondary" className="mt-6">
          {t('inventory.filters.ageRange.apply')}
        </Button>
      </fieldset>
    </form>
  );
}
