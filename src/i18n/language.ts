import { z } from 'zod';
import type { Locale } from '@/lib/format';

/** Supported UI languages (A-16). English is the default on first use, whatever the browser says. */
export const LANGUAGES = ['en', 'vi'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

/** localStorage key of the per-browser language preference (TA-25). */
export const LANGUAGE_STORAGE_KEY = 'inventory.language';

const LanguageSchema = z.enum(LANGUAGES);

/** Formatting locale per UI language (TA-26). */
export const LOCALES = { en: 'en-GB', vi: 'vi-VN' } as const satisfies Record<Language, Locale>;

/**
 * Each language's name in its own language (AC-015.6). These are endonyms, so they are not
 * translated: "Tiếng Việt" reads the same whatever the current UI language is.
 */
export const LANGUAGE_NAMES = { en: 'English', vi: 'Tiếng Việt' } as const satisfies Record<
  Language,
  string
>;

/** Narrow any value (stored preference, i18next code, select value) to a supported language. */
export function toLanguage(value: unknown): Language {
  const parsed = LanguageSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_LANGUAGE;
}

/** The stored preference; a missing or invalid value, or a storage error, gives English (TA-25). */
export function readStoredLanguage(): Language {
  try {
    return toLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/** Remember the choice for this browser. Storage can be unavailable (private mode, quota). */
export function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The choice still applies to this session; it just won't survive a reload.
  }
}
