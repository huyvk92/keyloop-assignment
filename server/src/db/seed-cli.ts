import { loadConfig } from '../config';
import { fixedClock, systemClock } from '../lib/clock';
import { openDatabase } from './connection';
import { migrate } from './migrate';
import { seedIfEmpty } from './seed';

const config = loadConfig();
const db = openDatabase(config.DATABASE_PATH);
const applied = migrate(db);
const seeded = seedIfEmpty(db, config.APP_TODAY ? fixedClock(config.APP_TODAY) : systemClock);
db.close();

console.warn(`Migrations applied: ${applied.join(', ') || 'none'}`);
console.warn(`Seeders run: ${seeded.join(', ') || 'none (data already present)'}`);
