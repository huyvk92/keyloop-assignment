import { HttpError } from '@/lib/http';

/** User-facing error text. Raw server or runtime messages are never shown (TRD section 6). */
export const ERROR_MESSAGES = {
  vehicleNotAging: 'Actions can only be logged for vehicles in stock for more than 90 days.',
  validation: 'Some fields are invalid.',
  notFound: "We couldn't find what you were looking for. It may have been removed.",
  network: "Couldn't reach the server. Check your connection and try again.",
  server: 'The server ran into a problem. Try again in a moment.',
  unknown: 'Something went wrong. Try again.',
} as const;

const BY_CODE: Partial<Record<string, string>> = {
  VEHICLE_NOT_AGING: ERROR_MESSAGES.vehicleNotAging,
  VALIDATION_ERROR: ERROR_MESSAGES.validation,
  NOT_FOUND: ERROR_MESSAGES.notFound,
};

function messageForHttpError(error: HttpError): string {
  const byCode = error.code ? BY_CODE[error.code] : undefined;
  if (byCode) return byCode;
  if (error.status >= 500) return ERROR_MESSAGES.server;
  if (error.status === 400) return ERROR_MESSAGES.validation;
  if (error.status === 404) return ERROR_MESSAGES.notFound;
  return ERROR_MESSAGES.unknown;
}

/** Map any thrown value (HttpError, fetch network failure, anything else) to user-friendly text. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof HttpError) return messageForHttpError(error);
  // fetch() rejects with a TypeError when the request never reaches the server.
  if (error instanceof TypeError) return ERROR_MESSAGES.network;
  return ERROR_MESSAGES.unknown;
}
