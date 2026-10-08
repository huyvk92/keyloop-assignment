import { LOGGED_BY_STORAGE_KEY, useLoggedByStore } from './store';

/** What a reload does: start from the empty state, then read the browser's storage again. */
async function reloadFrom(stored: string | null) {
  useLoggedByStore.setState(useLoggedByStore.getInitialState(), true);
  if (stored === null) window.localStorage.removeItem(LOGGED_BY_STORAGE_KEY);
  else window.localStorage.setItem(LOGGED_BY_STORAGE_KEY, stored);
  await useLoggedByStore.persist.rehydrate();
  return useLoggedByStore.getState().loggedBy;
}

const persisted = (loggedBy: unknown, version = 1) =>
  JSON.stringify({ state: { loggedBy }, version });

describe('useLoggedByStore (T-037, US-012)', () => {
  // Storage spies must not leak into later tests, even when an assertion fails first.
  afterEach(() => vi.restoreAllMocks());

  it('starts empty and remembers a name in localStorage (AC-012.1)', () => {
    expect(useLoggedByStore.getState().loggedBy).toBe('');

    useLoggedByStore.getState().setLoggedBy('Jane Smith');

    expect(useLoggedByStore.getState().loggedBy).toBe('Jane Smith');
    expect(JSON.parse(window.localStorage.getItem(LOGGED_BY_STORAGE_KEY) ?? 'null')).toEqual({
      state: { loggedBy: 'Jane Smith' },
      version: 1,
    });
  });

  it('stores the trimmed name and ignores a name the contract rejects (BR-12)', () => {
    useLoggedByStore.getState().setLoggedBy('  Jane Smith ');
    expect(useLoggedByStore.getState().loggedBy).toBe('Jane Smith');

    for (const invalid of ['', '   ', '\u200b', 'x'.repeat(101)]) {
      useLoggedByStore.getState().setLoggedBy(invalid);
      expect(useLoggedByStore.getState().loggedBy).toBe('Jane Smith');
    }
  });

  it('restores a valid stored name after a reload (AC-012.1)', async () => {
    expect(await reloadFrom(persisted('Jane Smith'))).toBe('Jane Smith');
    expect(await reloadFrom(persisted('x'.repeat(100)))).toBe('x'.repeat(100));
    // 100 code points, 200 UTF-16 units: the limit counts characters (TA-30).
    expect(await reloadFrom(persisted('😀'.repeat(100)))).toBe('😀'.repeat(100));
  });

  it.each([
    ['blank', persisted(' ')],
    ['zero-width only (TA-30)', persisted('\u200b\u200b')],
    ['too long (500 characters)', persisted('x'.repeat(500))],
    ['101 characters', persisted('x'.repeat(101))],
    ['not a string', persisted(42)],
    ['null', persisted(null)],
    ['missing', JSON.stringify({ state: {}, version: 1 })],
    ['another version', persisted('Jane Smith', 99)],
    ['not JSON', '{oops'],
    ['not an object', '"Jane Smith"'],
  ])('ignores a stored value that is %s', async (_case, stored) => {
    expect(await reloadFrom(stored)).toBe('');
  });

  it('starts empty when nothing is stored', async () => {
    expect(await reloadFrom(null)).toBe('');
  });

  it('keeps working in memory when storage is unavailable (private mode, quota)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    useLoggedByStore.getState().setLoggedBy('Jane Smith');

    expect(useLoggedByStore.getState().loggedBy).toBe('Jane Smith');
  });

  it('removes the stored name when the persisted storage is cleared', () => {
    useLoggedByStore.getState().setLoggedBy('Jane Smith');
    expect(window.localStorage.getItem(LOGGED_BY_STORAGE_KEY)).not.toBeNull();

    useLoggedByStore.persist.clearStorage();

    expect(window.localStorage.getItem(LOGGED_BY_STORAGE_KEY)).toBeNull();
  });

  it('ignores a storage error while clearing (nothing to clean up)', () => {
    useLoggedByStore.getState().setLoggedBy('Jane Smith');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    expect(() => useLoggedByStore.persist.clearStorage()).not.toThrow();

    expect(removeItem).toHaveBeenCalledWith(LOGGED_BY_STORAGE_KEY);
    expect(useLoggedByStore.getState().loggedBy).toBe('Jane Smith');
  });

  it('starts from the initial state in every test (reset in setup.ts)', () => {
    expect(useLoggedByStore.getState().loggedBy).toBe('');
    expect(window.localStorage.getItem(LOGGED_BY_STORAGE_KEY)).toBeNull();
  });
});
