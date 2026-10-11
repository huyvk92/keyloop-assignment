/**
 * Runs before the API starts (playwright.config.ts `webServer`): deletes the e2e SQLite file and
 * its WAL/SHM side files, so every run migrates and seeds a fresh database. Only the main
 * Playwright process launches web servers, so this never runs while the API has the file open.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

const databasePath = process.env.DATABASE_PATH;
if (!databasePath) throw new Error('DATABASE_PATH must be set for the e2e API.');

for (const suffix of ['', '-wal', '-shm']) rmSync(`${databasePath}${suffix}`, { force: true });
mkdirSync(dirname(databasePath), { recursive: true });
