import i18next, { type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  readStoredLanguage,
  storeLanguage,
  toLanguage,
  type Language,
} from './language';
import { en } from './resources/en';
import { vi } from './resources/vi';

export {
  DEFAULT_LANGUAGE,
  LANGUAGE_NAMES,
  LANGUAGE_STORAGE_KEY,
  LANGUAGES,
  LOCALES,
  readStoredLanguage,
  storeLanguage,
  toLanguage,
  type Language,
} from './language';

/** Declare the page language for screen readers and the browser (AC-015.1, AC-015.2). */
function applyDocumentLanguage(code: string) {
  document.documentElement.lang = toLanguage(code);
}

type Options = {
  /** Initial language; defaults to the stored preference, else English (A-16, TA-25). */
  language?: Language;
  /** Register as the instance `useTranslation()` reads. Only the app singleton does this. */
  bindReact?: boolean;
};

/**
 * Create an initialised i18next instance. Resources are bundled, so initialisation is
 * synchronous: the first render is already in the right language. There is deliberately no
 * browser-language detection (A-16).
 */
export function createI18n({ language = readStoredLanguage(), bindReact = false }: Options = {}) {
  const instance = i18next.createInstance();
  if (bindReact) instance.use(initReactI18next);
  instance.on('languageChanged', applyDocumentLanguage);
  void instance.init({
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: LANGUAGES,
    resources: { en: { translation: en }, vi: { translation: vi } },
    initAsync: false,
    returnNull: false,
    // React already escapes rendered text.
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

/** The app-wide instance used by `useTranslation()`. */
export const i18n: I18n = createI18n({ bindReact: true });

/** Switch language from a user choice: re-renders the UI and remembers it for this browser. */
export async function changeLanguage(language: Language): Promise<void> {
  storeLanguage(language);
  await i18n.changeLanguage(language);
}
