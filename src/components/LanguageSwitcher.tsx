import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, LANGUAGE_NAMES, LANGUAGES, toLanguage } from '@/i18n';
import { cn } from '@/lib/cn';

type Props = { className?: string };

/**
 * Native `<select>` for the UI language (US-015): labelled, keyboard operable without extra code,
 * and each option carries `lang` so screen readers pronounce it in its own language (AC-015.6).
 * Switching re-renders in place: no reload, no URL change (AC-015.2, TA-25).
 */
export function LanguageSwitcher({ className }: Props) {
  const { t, i18n } = useTranslation();
  const selectId = useId();
  const current = toLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <label htmlFor={selectId} className="text-slate-600">
        {t('language.label')}
      </label>
      <select
        id={selectId}
        value={current}
        onChange={(event) => void changeLanguage(toLanguage(event.target.value))}
        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
      >
        {LANGUAGES.map((language) => (
          <option key={language} value={language} lang={language}>
            {LANGUAGE_NAMES[language]}
          </option>
        ))}
      </select>
    </div>
  );
}
