import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './connection';

describe('openDatabase', () => {
  it('creates missing folders and keeps data across reopen (service restart)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'api-db-'));
    const path = join(dir, 'nested', 'app.db');
    try {
      const first = openDatabase(path);
      first.exec('CREATE TABLE notes (text TEXT)');
      first.prepare('INSERT INTO notes VALUES (?)').run('persisted');
      first.close();

      const second = openDatabase(path);
      expect(second.prepare('SELECT text FROM notes').pluck().all()).toEqual(['persisted']);
      expect(second.pragma('foreign_keys', { simple: true })).toBe(1);
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
