import { useTranslation } from 'react-i18next';
import { Field } from '@/components/Field';
import { Select } from '@/components/Select';
import { changeLanguage, LANGUAGE_NAMES, LANGUAGES, toLanguage } from '@/i18n';

type Props = { className?: string };

/**
 * Native `<select>` for the UI language (US-015): labelled, keyboard operable without extra code,
 * and each option carries `lang` so screen readers pronounce it in its own language (AC-015.6).
 * Switching re-renders in place: no reload, no URL change (AC-015.2, TA-25).
 */
export function LanguageSwitcher({ className }: Props) {
  const { t, i18n } = useTranslation();
  const current = toLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <Field
      label={t('language.label')}
      layout="inline"
      className={className}
      labelClassName="font-normal text-slate-600"
    >
      {(control) => (
        <Select
          {...control}
          size="sm"
          value={current}
          onChange={(event) => void changeLanguage(toLanguage(event.target.value))}
        >
          {LANGUAGES.map((language) => (
            <option key={language} value={language} lang={language}>
              {LANGUAGE_NAMES[language]}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
