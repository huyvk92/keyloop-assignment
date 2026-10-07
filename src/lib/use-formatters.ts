import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCALES, toLanguage } from '@/i18n';
import {
  formatDate,
  formatDateTime,
  formatInteger,
  formatMileage,
  formatMoney,
  type Locale,
} from '@/lib/format';

export type Formatters = {
  locale: Locale;
  money: (amountMinor: number, currency: string) => string;
  date: (isoDate: string) => string;
  dateTime: (isoInstant: string, timeZone: string) => string;
  integer: (value: number) => string;
  mileage: (miles: number) => string;
};

/**
 * `lib/format` helpers bound to the current UI language (TA-26). Components re-render with the
 * new formats when the language changes, because `useTranslation` subscribes to the change.
 */
export function useFormatters(): Formatters {
  const { i18n } = useTranslation();
  const locale = LOCALES[toLanguage(i18n.resolvedLanguage ?? i18n.language)];
  return useMemo(
    () => ({
      locale,
      money: (amountMinor, currency) => formatMoney(amountMinor, currency, locale),
      date: (isoDate) => formatDate(isoDate, locale),
      dateTime: (isoInstant, timeZone) => formatDateTime(isoInstant, timeZone, locale),
      integer: (value) => formatInteger(value, locale),
      mileage: (miles) => formatMileage(miles, locale),
    }),
    [locale],
  );
}
