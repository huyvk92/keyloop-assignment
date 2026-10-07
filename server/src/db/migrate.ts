import type { Db } from './connection';

export type Migration = { id: number; name: string; sql: string };

/**
 * Ordered schema migrations. Append new entries with the next id; never edit or reorder an
 * entry that has been applied anywhere - write a new migration instead.
 */
export const migrations: Migration[] = [];

/** Apply pending migrations, each in its own transaction. Returns the names applied. */
export function migrate(db: Db, list: Migration[] = migrations): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(db.prepare<[], number>('SELECT id FROM schema_migrations').pluck().all());
  const record = db.prepare(
    'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)',
  );
  const pending = list.filter((m) => !applied.has(m.id)).sort((a, b) => a.id - b.id);

  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql);
      record.run(migration.id, migration.name, new Date().toISOString());
    })();
  }
  return pending.map((m) => m.name);
}
