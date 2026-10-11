import { ZodError } from 'zod';
import { i18n } from '@/i18n';
import { en } from '@/i18n/resources/en';
import { getErrorMessage as getMessage, getErrorMessageKey } from '@/lib/error-messages';
import { HttpError } from '@/lib/http';

const ERROR_MESSAGES = en.errors.messages;
const getErrorMessage = (error: unknown) => getMessage(error, i18n.t);

function apiError(status: number, code: string) {
  return new HttpError(status, `Request failed with status ${status}`, {
    error: { code, message: 'raw server message' },
  });
}

describe('getErrorMessage', () => {
  it('maps 422 VEHICLE_NOT_AGING to an explanation', () => {
    expect(getErrorMessage(apiError(422, 'VEHICLE_NOT_AGING'))).toBe(
      'Actions can only be logged for vehicles in stock for more than 90 days.',
    );
  });

  it('maps 400 VALIDATION_ERROR, and a bare 400, to the validation message', () => {
    expect(getErrorMessage(apiError(400, 'VALIDATION_ERROR'))).toBe('Some fields are invalid.');
    expect(getErrorMessage(new HttpError(400, 'Bad request'))).toBe(ERROR_MESSAGES.validation);
  });

  it('maps 404 NOT_FOUND, and a bare 404, to the not-found message', () => {
    expect(getErrorMessage(apiError(404, 'NOT_FOUND'))).toBe(ERROR_MESSAGES.notFound);
    expect(getErrorMessage(new HttpError(404, 'Not found'))).toBe(ERROR_MESSAGES.notFound);
  });

  it('maps a network failure (fetch TypeError) to the connectivity message', () => {
    expect(getErrorMessage(new TypeError('Failed to fetch'))).toBe(
      "Couldn't reach the server. Check your connection and try again.",
    );
  });

  it('maps 5xx responses to the server-problem message', () => {
    expect(getErrorMessage(apiError(500, 'INTERNAL_ERROR'))).toBe(ERROR_MESSAGES.server);
    expect(getErrorMessage(new HttpError(503, 'Service unavailable'))).toBe(ERROR_MESSAGES.server);
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(getErrorMessage(new Error('boom'))).toBe(ERROR_MESSAGES.unknown);
    expect(getErrorMessage('a string')).toBe(ERROR_MESSAGES.unknown);
    expect(getErrorMessage(undefined)).toBe(ERROR_MESSAGES.unknown);
    expect(getErrorMessage(new ZodError([]))).toBe(ERROR_MESSAGES.unknown);
    expect(getErrorMessage(apiError(409, 'CONFLICT'))).toBe(ERROR_MESSAGES.unknown);
  });

  it('never exposes the raw server message', () => {
    expect(getErrorMessage(apiError(422, 'SOMETHING_NEW'))).not.toContain('raw server message');
  });

  it('returns the message in the current language (BR-19)', async () => {
    await i18n.changeLanguage('vi');

    expect(getErrorMessage(apiError(503, 'INTERNAL_ERROR'))).toBe(
      'Máy chủ đang gặp sự cố. Vui lòng thử lại sau giây lát.',
    );
    expect(getErrorMessage(new TypeError('Failed to fetch'))).toBe(
      'Không thể kết nối với máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
    );
  });

  it('exposes the translation key for callers that translate themselves', () => {
    expect(getErrorMessageKey(apiError(422, 'VEHICLE_NOT_AGING'))).toBe(
      'errors.messages.vehicleNotAging',
    );
  });
});
