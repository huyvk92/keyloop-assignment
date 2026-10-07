import { openDatabase } from './connection';
import { migrate, type Migration } from './migrate';

const createWidgets: Migration = {
  id: 1,
  name: '001_create_widgets',
  sql: 'CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT NOT NULL)',
};

describe('migrate', () => {
  it('applies pending migrations once and records them', () => {
    const db = openDatabase(':memory:');

    expect(migrate(db, [createWidgets])).toEqual(['001_create_widgets']);
    expect(migrate(db, [createWidgets])).toEqual([]);
    db.prepare('INSERT INTO widgets (name) VALUES (?)').run('a');
    db.close();
  });

  it('rolls back a failing migration and leaves no record', () => {
    const db = openDatabase(':memory:');
    const broken: Migration = {
      id: 2,
      name: '002_broken',
      sql: 'CREATE TABLE gadgets (id INTEGER PRIMARY KEY); INSERT INTO missing VALUES (1);',
    };

    expect(() => migrate(db, [createWidgets, broken])).toThrow();
    const recorded = db.prepare('SELECT name FROM schema_migrations').pluck().all();
    expect(recorded).toEqual(['001_create_widgets']);
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'gadgets'").get(),
    ).toBeUndefined();
    db.close();
  });
});
