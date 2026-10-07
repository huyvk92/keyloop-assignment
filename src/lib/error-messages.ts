import type { TFunction } from 'i18next';
import type { en } from '@/i18n/resources/en';
import { HttpError } from '@/lib/http';

type ErrorMessage = keyof typeof en.errors.messages;

/** Translation key of a user-facing error message (`errors.messages.*`). */
export type ErrorMessageKey = `errors.messages.${ErrorMessage}`;

const key = (message: ErrorMessage): ErrorMessageKey => `errors.messages.${message}`;

const BY_CODE: Partial<Record<string, ErrorMessage>> = {
  VEHICLE_NOT_AGING: 'vehicleNotAging',
  VALIDATION_ERROR: 'validation',
  NOT_FOUND: 'notFound',
};

function messageForHttpError(error: HttpError): ErrorMessage {
  const byCode = error.code ? BY_CODE[error.code] : undefined;
  if (byCode) return byCode;
  if (error.status >= 500) return 'server';
  if (error.status === 400) return 'validation';
  if (error.status === 404) return 'notFound';
  return 'unknown';
}

/**
 * Map any thrown value (HttpError, fetch network failure, anything else) to the key of a
 * user-friendly message. Raw server or runtime messages are never shown (TRD section 6).
 */
export function getErrorMessageKey(error: unknown): ErrorMessageKey {
  if (error instanceof HttpError) return key(messageForHttpError(error));
  // fetch() rejects with a TypeError when the request never reaches the server.
  if (error instanceof TypeError) return key('network');
  return key('unknown');
}

/** The user-friendly message in the language of `t` (from `useTranslation()`). */
export function getErrorMessage(error: unknown, t: TFunction): string {
  return t(getErrorMessageKey(error));
}
