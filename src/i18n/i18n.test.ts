import { ACTION_STATUSES } from '@shared/api/actions';
import {
  changeLanguage,
  createI18n,
  i18n,
  LANGUAGE_STORAGE_KEY,
  readStoredLanguage,
  storeLanguage,
  toLanguage,
} from '@/i18n';
import { en } from '@/i18n/resources/en';
import { vi as viResources } from '@/i18n/resources/vi';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Every leaf as [dotted key, value]. */
function leaves(node: object, prefix = ''): [string, unknown][] {
  return Object.entries(node).flatMap(([key, value]): [string, unknown][] => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null ? leaves(value, path) : [[path, value]];
  });
}

describe('language preference (A-16, TA-25)', () => {
  it('opens in English on first use, even when the browser language is Vietnamese (AC-015.1)', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('vi-VN');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['vi-VN', 'vi']);

    const instance = createI18n();

    expect(instance.language).toBe('en');
    expect(instance.t('app.title')).toBe('Inventory dashboard');
    expect(document.documentElement.lang).toBe('en');
  });

  it('restores a stored Vietnamese choice (AC-015.3)', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'vi');

    const instance = createI18n();

    expect(instance.language).toBe('vi');
    expect(instance.t('app.title')).toBe('Bảng điều khiển tồn kho');
    expect(document.documentElement.lang).toBe('vi');
  });

  it.each(['fr', 'VI', 'vi-VN', '', '"vi"'])('ignores an invalid stored value %j', (stored) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, stored);

    expect(readStoredLanguage()).toBe('en');
    expect(createI18n().language).toBe('en');
  });

  it('falls back to English when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(readStoredLanguage()).toBe('en');
    expect(createI18n().language).toBe('en');
  });

  it('keeps working when storage cannot be written', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(() => storeLanguage('vi')).not.toThrow();
    await changeLanguage('vi');
    expect(i18n.language).toBe('vi');
  });

  it('switches the app language, declares it on <html> and remembers it', async () => {
    await changeLanguage('vi');

    expect(i18n.language).toBe('vi');
    expect(document.documentElement.lang).toBe('vi');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');

    await changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('narrows unknown codes to a supported language', () => {
    expect(toLanguage('vi')).toBe('vi');
    expect(toLanguage('en')).toBe('en');
    expect(toLanguage('de')).toBe('en');
    expect(toLanguage(undefined)).toBe('en');
  });
});

describe('resources (ADR-009)', () => {
  it('has every English key in Vietnamese, with no extra keys and no empty values', () => {
    const enLeaves = leaves(en);
    const viLeaves = leaves(viResources);

    expect(viLeaves.map(([key]) => key).sort()).toEqual(enLeaves.map(([key]) => key).sort());
    for (const [key, value] of [...enLeaves, ...viLeaves]) {
      expect(typeof value, key).toBe('string');
      expect(String(value).trim(), key).not.toBe('');
    }
  });

  it('keeps the same interpolation variables in both languages', () => {
    const variables = (text: unknown) => [...String(text).matchAll(/{{(\w+)}}/g)].map((m) => m[1]);
    const viByKey = new Map(leaves(viResources));

    for (const [key, value] of leaves(en)) {
      expect(variables(viByKey.get(key)).sort(), key).toEqual(variables(value).sort());
    }
  });

  it('labels every canonical action status; the English label is the canonical value (BR-19)', () => {
    for (const status of ACTION_STATUSES) {
      expect(i18n.t(`actionStatus.${status}`)).toBe(status);
      expect(i18n.t(`actionStatus.${status}`, { lng: 'vi' })).not.toBe(status);
    }
    expect(Object.keys(en.actionStatus).sort()).toEqual([...ACTION_STATUSES].sort());
  });
});
