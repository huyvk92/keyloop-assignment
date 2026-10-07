import type { Db } from './connection';

export type Migration = { id: number; name: string; sql: string };

/**
 * Ordered schema migrations. Append new entries with the next id; never edit or reorder an
 * entry that has been applied anywhere - write a new migration instead.
 */
export const migrations: Migration[] = [
  {
    // TRD 4.3. Dates are YYYY-MM-DD, timestamps ISO-8601 UTC; "now" is never computed in SQL.
    id: 1,
    name: 'inventory-schema',
    sql: `
      CREATE TABLE dealerships (
        id         INTEGER PRIMARY KEY,
        name       TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 100),
        currency   TEXT NOT NULL CHECK (length(currency) = 3 AND currency = upper(currency)),
        time_zone  TEXT NOT NULL CHECK (length(time_zone) BETWEEN 1 AND 64)
      ) STRICT;

      CREATE TABLE vehicles (
        id               INTEGER PRIMARY KEY,
        dealership_id    INTEGER NOT NULL REFERENCES dealerships(id),
        vin              TEXT NOT NULL UNIQUE CHECK (length(vin) = 17),
        stock_number     TEXT NOT NULL CHECK (length(stock_number) BETWEEN 1 AND 20),
        make             TEXT NOT NULL CHECK (length(make) BETWEEN 1 AND 50),
        model            TEXT NOT NULL CHECK (length(model) BETWEEN 1 AND 50),
        model_year       INTEGER NOT NULL CHECK (model_year BETWEEN 1990 AND 2100),
        trim_level       TEXT NOT NULL CHECK (length(trim_level) BETWEEN 1 AND 50),
        colour           TEXT NOT NULL CHECK (length(colour) BETWEEN 1 AND 30),
        mileage          INTEGER NOT NULL CHECK (mileage >= 0),
        list_price_minor INTEGER NOT NULL CHECK (list_price_minor >= 0),
        stock_in_date    TEXT NOT NULL CHECK (date(stock_in_date) IS stock_in_date),
        UNIQUE (dealership_id, stock_number)
      ) STRICT;
      CREATE INDEX idx_vehicles_dealer_stockin
        ON vehicles (dealership_id, stock_in_date, stock_number);
      CREATE INDEX idx_vehicles_dealer_make_model ON vehicles (dealership_id, make, model);
      CREATE INDEX idx_vehicles_dealer_price ON vehicles (dealership_id, list_price_minor);

      CREATE TABLE vehicle_actions (
        id         INTEGER PRIMARY KEY,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
        status     TEXT NOT NULL CHECK (status IN ('Price Reduction Planned', 'Marketing Promotion',
                     'Transfer to Another Dealership', 'Send to Auction/Wholesale', 'Under Review')),
        note       TEXT CHECK (note IS NULL OR length(note) BETWEEN 1 AND 500),
        logged_by  TEXT NOT NULL
                     CHECK (length(logged_by) BETWEEN 1 AND 100 AND logged_by = trim(logged_by)),
        -- Exactly Date#toISOString() output: UTC with millisecond precision (TA-12)
        logged_at  TEXT NOT NULL CHECK (logged_at GLOB
          '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z')
      ) STRICT;
      CREATE INDEX idx_actions_vehicle_latest
        ON vehicle_actions (vehicle_id, logged_at DESC, id DESC);
      CREATE TRIGGER vehicle_actions_no_update BEFORE UPDATE ON vehicle_actions
        BEGIN SELECT RAISE(ABORT, 'vehicle_actions is append-only'); END;
      CREATE TRIGGER vehicle_actions_no_delete BEFORE DELETE ON vehicle_actions
        BEGIN SELECT RAISE(ABORT, 'vehicle_actions is append-only'); END;
    `,
  },
];

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
