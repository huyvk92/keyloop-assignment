import {
  LOGGED_BY_MAX_LENGTH,
  NOTE_MAX_LENGTH,
  type CreateActionBodyInput,
} from '@shared/api/actions';
import type { TFunction } from 'i18next';
import type { FieldError } from 'react-hook-form';

export type LogActionField = keyof CreateActionBodyInput;

/**
 * Translated message for a "Log action" field error. The contract's Zod messages are English
 * only, so the message is chosen from the field and the Zod issue code (`FieldError.type`, set by
 * zodResolver) and the raw message is never shown (BR-19). Unknown codes fall back to a generic
 * per-field text. Limits are formatted with the current language's integer format, like the
 * live character counter.
 */
export function logActionErrorMessage(
  field: LogActionField,
  error: FieldError | undefined,
  t: TFunction,
  formatInteger: (value: number) => string,
): string | undefined {
  if (!error) return undefined;
  switch (field) {
    case 'status':
      // Missing or not one of ACTION_STATUSES: both mean "pick one" (BR-10).
      return t('vehicleActions.form.errors.statusRequired');
    case 'note':
      return error.type === 'too_big'
        ? t('vehicleActions.form.errors.noteTooLong', { max: formatInteger(NOTE_MAX_LENGTH) })
        : t('vehicleActions.form.errors.invalid');
    case 'loggedBy':
      if (error.type === 'too_big') {
        return t('vehicleActions.form.errors.loggedByTooLong', {
          max: formatInteger(LOGGED_BY_MAX_LENGTH),
        });
      }
      // too_small (blank after trimming) or a missing value (BR-12).
      return t('vehicleActions.form.errors.loggedByRequired');
  }
}
