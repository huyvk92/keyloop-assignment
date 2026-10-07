import { fixedClock } from '../lib/clock';
import { openDatabase } from './connection';
import { seedIfEmpty, type Seeder } from './seed';

const widgets: Seeder = {
  name: 'widgets',
  isSeeded: (db) => db.prepare<[], number>('SELECT COUNT(*) FROM widgets').pluck().get() !== 0,
  run: (db, clock) => {
    db.prepare('INSERT INTO widgets (created_on) VALUES (?)').run(
      clock.now().toISOString().slice(0, 10),
    );
  },
};

describe('seedIfEmpty', () => {
  it('runs seeders only when their data is missing, using the injected clock', () => {
    const db = openDatabase(':memory:');
    db.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY, created_on TEXT NOT NULL)');
    const clock = fixedClock('2026-10-07');

    expect(seedIfEmpty(db, clock, [widgets])).toEqual(['widgets']);
    expect(seedIfEmpty(db, clock, [widgets])).toEqual([]);
    expect(db.prepare('SELECT created_on FROM widgets').pluck().all()).toEqual(['2026-10-07']);
    db.close();
  });
});
