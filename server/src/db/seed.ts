import type { Clock } from '../lib/clock';
import { inventorySeeder } from '../modules/inventory/inventory.seed';
import type { Db } from './connection';

export type Seeder = {
  name: string;
  /** True when this seeder's data already exists (seeding is skipped). */
  isSeeded: (db: Db) => boolean;
  run: (db: Db, clock: Clock) => void;
};

/** Sample-data seeders, run in order on startup when their data is missing. */
export const seeders: Seeder[] = [inventorySeeder];

/** Run every seeder whose data is missing, each in a transaction. Returns the names run. */
export function seedIfEmpty(db: Db, clock: Clock, list: Seeder[] = seeders): string[] {
  const ran: string[] = [];
  for (const seeder of list) {
    if (seeder.isSeeded(db)) continue;
    db.transaction(() => seeder.run(db, clock))();
    ran.push(seeder.name);
  }
  return ran;
}
