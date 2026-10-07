import { buildApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/connection';
import { migrate } from './db/migrate';
import { seedIfEmpty } from './db/seed';
import { fixedClock, systemClock } from './lib/clock';

const config = loadConfig();
const clock = config.APP_TODAY ? fixedClock(config.APP_TODAY) : systemClock;

const db = openDatabase(config.DATABASE_PATH);
const applied = migrate(db);
const seeded = seedIfEmpty(db, clock);

const app = await buildApp({ db, clock, config }, { logger: { level: config.LOG_LEVEL } });
app.log.info({ applied, seeded, today: clock.now().toISOString().slice(0, 10) }, 'Database ready');

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  db.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: config.HOST, port: config.PORT });
