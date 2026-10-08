import { CreateActionBodySchema } from '@shared/api/actions';
import { z } from 'zod';
import { create } from 'zustand';
import { devtools, persist, type PersistStorage } from 'zustand/middleware';

/** localStorage key of the remembered "Logged by" name (US-012, TRD section 5). */
export const LOGGED_BY_STORAGE_KEY = 'inventory.loggedBy';
const STORAGE_VERSION = 1;

/** The contract's rule (BR-12, TA-30): trimmed, not blank, at most 100 characters. */
const LoggedBySchema = CreateActionBodySchema.shape.loggedBy;

type Persisted = { loggedBy: string };

type LoggedByState = Persisted & {
  /** Remember `name` (trimmed) if the contract accepts it; anything else is ignored. */
  setLoggedBy: (name: string) => void;
};

/** What `persist` writes: `{ state, version }`. Storage is external data, so it is validated. */
const StoredSchema = z.object({
  state: z.object({ loggedBy: LoggedBySchema }),
  version: z.literal(STORAGE_VERSION),
});

/**
 * localStorage behind a Zod check: a value another version, a person or an extension left there
 * (blank, too long, not a string, not JSON) is ignored, as is any storage error (private mode,
 * quota); the name then simply isn't remembered.
 */
const storage: PersistStorage<Persisted> = {
  getItem: (name) => {
    try {
      const raw = window.localStorage.getItem(name);
      if (raw === null) return null;
      const parsed = StoredSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, JSON.stringify(value));
    } catch {
      // Still remembered for this session.
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Nothing to clean up.
    }
  },
};

/**
 * The last "Logged by" name saved in this browser (US-012, AC-012.1), so the log form can be
 * pre-filled, also after a reload. Written only after a successful save (`useLogAction`).
 */
export const useLoggedByStore = create<LoggedByState>()(
  devtools(
    persist(
      (set) => ({
        loggedBy: '',
        setLoggedBy: (name) => {
          const parsed = LoggedBySchema.safeParse(name);
          if (parsed.success) set({ loggedBy: parsed.data });
        },
      }),
      {
        name: LOGGED_BY_STORAGE_KEY,
        version: STORAGE_VERSION,
        storage,
        partialize: ({ loggedBy }) => ({ loggedBy }),
      },
    ),
    { name: 'logged-by-store', enabled: import.meta.env.DEV },
  ),
);
