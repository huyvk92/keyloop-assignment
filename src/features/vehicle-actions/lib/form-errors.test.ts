import { i18n } from '@/i18n';
import { formatInteger } from '@/lib/format';
import { logActionErrorMessage, type LogActionField } from './form-errors';

const t = i18n.t.bind(i18n);
const err = (type: string) => ({ type, message: 'raw English Zod message' });
const message = (
  field: LogActionField,
  error: ReturnType<typeof err> | undefined,
  integer = (value: number) => formatInteger(value, 'en-GB'),
) => logActionErrorMessage(field, error, t, integer);

describe('logActionErrorMessage', () => {
  it('maps field + Zod issue code to translated text, never the raw message', () => {
    expect(message('status', err('invalid_value'))).toBe('Select an action status.');
    expect(message('note', err('too_big'))).toBe('Note must be 500 characters or fewer.');
    expect(message('note', err('invalid_type'))).toBe('Check this field.');
    expect(message('loggedBy', err('too_small'))).toBe('Enter your name.');
    expect(message('loggedBy', err('invalid_type'))).toBe('Enter your name.');
    expect(message('loggedBy', err('too_big'))).toBe('Name must be 100 characters or fewer.');
    expect(message('loggedBy', undefined)).toBeUndefined();
  });

  it('formats the limits with the given number format', () => {
    const marked = (value: number) => `<${value}>`;

    expect(message('note', err('too_big'), marked)).toBe('Note must be <500> characters or fewer.');
    expect(message('loggedBy', err('too_big'), marked)).toBe(
      'Name must be <100> characters or fewer.',
    );
  });

  it('uses the Vietnamese text in Vietnamese', async () => {
    await i18n.changeLanguage('vi');

    expect(message('loggedBy', err('too_big'))).toBe('Tên không được vượt quá 100 ký tự.');
    expect(message('note', err('too_big'))).toBe('Ghi chú không được vượt quá 500 ký tự.');
  });
});
