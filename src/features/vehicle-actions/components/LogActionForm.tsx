import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateActionBodySchema,
  NOTE_MAX_LENGTH,
  type CreateActionBody,
} from '@shared/api/actions';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/Field';
import { TextInput } from '@/components/TextInput';
import { cn } from '@/lib/cn';
import { controlBase } from '@/lib/control-styles';
import { useFormatters } from '@/lib/use-formatters';
import { logActionErrorMessage, type LogActionField } from '../lib/form-errors';
import { StatusRadioGroup } from './StatusRadioGroup';

type Props = {
  /** Saves the parsed (trimmed) body. Resolve on success; reject to show the error. */
  onSubmit: (body: CreateActionBody) => Promise<unknown>;
};

type Outcome = { kind: 'saved' } | { kind: 'failed'; error: unknown } | null;

/**
 * "Log action" form (US-006): status, optional note with a live character count, and "Logged by",
 * validated by the contract schema (BR-10..BR-12). Errors are text linked to their control, and
 * on submit focus goes to the first invalid field, the status group first (AC-006.4).
 *
 * Default values are set once, at mount: the form is never fed query data, so a background
 * refetch can't reset what the user typed (AC-009.1). After a save, status and note are cleared
 * and "Logged by" is kept; after a failure every input keeps its value and Save retries (AC-006.7).
 *
 * Focus: Save is never natively disabled while saving (`aria-disabled` + a guard here), so a
 * keyboard user doesn't fall back to `<body>`. On success focus stays where it was (usually Save,
 * ready for the next entry) and the polite status announces "Action saved". On failure it moves to
 * the error alert, which sits right above Save: the message is read and one Tab reaches Save to
 * retry (AC-006.7).
 */
export function LogActionForm({ onSubmit }: Props) {
  const { t } = useTranslation();
  const { integer } = useFormatters();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  /** Set from the submit event until the save settles, so Enter or a click can't post twice. */
  const inFlight = useRef(false);
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(CreateActionBodySchema),
    defaultValues: { note: '', loggedBy: '' },
  });
  // Code points of the trimmed note, as the contract counts them (Zod 4's max, SQLite length()):
  // an emoji is 1, not its 2 UTF-16 units.
  const noteLength = Array.from((useWatch({ control, name: 'note' }) ?? '').trim()).length;
  const fieldError = (field: LogActionField) =>
    logActionErrorMessage(field, errors[field], t, integer);

  // Each failure is a new object, so a repeated failure moves focus to the alert again.
  useEffect(() => {
    if (outcome?.kind === 'failed') errorRef.current?.focus();
  }, [outcome]);

  const submit = handleSubmit(
    async (body) => {
      setOutcome(null);
      try {
        await onSubmit(body);
        const loggedBy = getValues('loggedBy');
        // Without values RHF also resets the native form, which is what unchecks the radios
        // (`reset({ ... })` would read the still-checked radio back from the DOM).
        reset();
        setValue('loggedBy', loggedBy);
        setOutcome({ kind: 'saved' });
      } catch (error) {
        setOutcome({ kind: 'failed', error });
      }
    },
    () => setOutcome(null),
  );

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    void submit(event).finally(() => {
      inFlight.current = false;
    });
  };

  return (
    <form noValidate onSubmit={handleFormSubmit} className="space-y-4">
      <StatusRadioGroup registration={register('status')} error={fieldError('status')} />
      <Field
        label={t('vehicleActions.form.note.label')}
        hint={
          <span className="flex justify-between gap-2">
            <span>{t('vehicleActions.form.note.hint', { max: integer(NOTE_MAX_LENGTH) })}</span>{' '}
            <span className={cn('tabular-nums', noteLength > NOTE_MAX_LENGTH && 'text-red-700')}>
              {t('vehicleActions.form.note.counter', {
                length: integer(noteLength),
                max: integer(NOTE_MAX_LENGTH),
              })}
            </span>
          </span>
        }
        error={fieldError('note')}
      >
        {(controlProps) => (
          <textarea
            {...controlProps}
            {...register('note')}
            rows={4}
            className={cn(controlBase, 'w-full px-3 py-2 text-sm')}
          />
        )}
      </Field>
      <Field label={t('vehicleActions.form.loggedBy')} error={fieldError('loggedBy')}>
        {(controlProps) => (
          <TextInput {...controlProps} {...register('loggedBy')} autoComplete="name" />
        )}
      </Field>
      {outcome?.kind === 'failed' && (
        <ErrorState
          ref={errorRef}
          // Programmatic focus target only (see above); not in the tab order.
          tabIndex={-1}
          error={outcome.error}
          title={t('vehicleActions.form.saveError')}
          className="focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        {/* aria-disabled while saving (keeps focus); handleFormSubmit blocks a second post. */}
        <Button type="submit" isLoading={isSubmitting}>
          {isSubmitting ? t('vehicleActions.form.submitting') : t('vehicleActions.form.submit')}
        </Button>
        {/* Present before it has text, so the confirmation is announced (user-triggered). */}
        <p role="status" className="text-sm font-medium text-green-700">
          {outcome?.kind === 'saved' ? t('vehicleActions.form.saved') : ''}
        </p>
      </div>
    </form>
  );
}
