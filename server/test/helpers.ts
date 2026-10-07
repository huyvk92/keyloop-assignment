import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { openDatabase } from '../src/db/connection';
import { migrate } from '../src/db/migrate';
import { seedIfEmpty, type Seeder } from '../src/db/seed';
import { fixedClock } from '../src/lib/clock';

type Options = {
  /** Pinned "today" (YYYY-MM-DD) for deterministic date rules. */
  today?: string;
  /** Seeders to run; defaults to none so each test controls its own data. */
  seeders?: Seeder[];
  /** Register extra routes before the app is ready (e.g. to exercise error handling). */
  setup?: (app: FastifyInstance) => void | Promise<void>;
};

/** A fully wired app on a fresh in-memory database. Call `close()` in afterEach. */
export async function createTestApp({ today = '2026-10-07', seeders = [], setup }: Options = {}) {
  const db = openDatabase(':memory:');
  migrate(db);
  const clock = fixedClock(today);
  seedIfEmpty(db, clock, seeders);

  const app = await buildApp(
    { db, clock, config: { CORS_ORIGIN: 'http://localhost:5173' } },
    { logger: false },
  );
  await setup?.(app);
  await app.ready();

  return {
    app,
    db,
    clock,
    close: async () => {
      await app.close();
      db.close();
    },
  };
}
