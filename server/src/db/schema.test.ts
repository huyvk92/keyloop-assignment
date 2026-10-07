import { ACTION_STATUSES } from '@shared/api/actions';
import { insertAction, insertDealership, insertVehicle } from '../../test/factories';
import { openDatabase, type Db } from './connection';
import { migrate, migrations } from './migrate';

let db: Db;
let dealershipId: number;
let vehicleId: number;

beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
  dealershipId = insertDealership(db);
  vehicleId = insertVehicle(db, { dealershipId, ageDays: 100 });
});
afterEach(() => db.close());

const count = (table: string) =>
  db.prepare<[], number>(`SELECT COUNT(*) FROM ${table}`).pluck().get();

describe('migration 1: inventory schema', () => {
  it('applies once and is idempotent', () => {
    const fresh = openDatabase(':memory:');
    expect(migrate(fresh)).toEqual(migrations.map((m) => m.name));
    expect(migrations.map((m) => m.id)).toEqual([1]);
    expect(migrate(fresh)).toEqual([]);
    fresh.close();
  });

  it('accepts valid rows from the factories', () => {
    insertAction(db, { vehicleId, note: 'Reduce by 5%' });
    expect([count('dealerships'), count('vehicles'), count('vehicle_actions')]).toEqual([1, 1, 1]);
  });

  describe('vehicle_actions CHECK constraints (BR-10..BR-13)', () => {
    it('rejects a status outside the list', () => {
      expect(() => insertAction(db, { vehicleId, status: 'Sold' as never })).toThrow(/CHECK/);
    });

    it('accepts every status in the shared ACTION_STATUSES list (BR-10 drift guard)', () => {
      for (const status of ACTION_STATUSES) {
        expect(() => insertAction(db, { vehicleId, status }), status).not.toThrow();
      }
      expect(count('vehicle_actions')).toBe(ACTION_STATUSES.length);
    });

    it('accepts a 500-char note and rejects 501 chars or an empty note', () => {
      insertAction(db, { vehicleId, note: 'a'.repeat(500) });
      expect(() => insertAction(db, { vehicleId, note: 'a'.repeat(501) })).toThrow(/CHECK/);
      expect(() => insertAction(db, { vehicleId, note: '' })).toThrow(/CHECK/);
    });

    it('rejects a padded, empty or 101-char logged_by', () => {
      expect(() => insertAction(db, { vehicleId, loggedBy: ' Jane ' })).toThrow(/CHECK/);
      expect(() => insertAction(db, { vehicleId, loggedBy: '' })).toThrow(/CHECK/);
      expect(() => insertAction(db, { vehicleId, loggedBy: 'a'.repeat(101) })).toThrow(/CHECK/);
    });

    it('accepts a logged_by of exactly 100 chars (BR-12)', () => {
      insertAction(db, { vehicleId, loggedBy: 'a'.repeat(100) });
      expect(count('vehicle_actions')).toBe(1);
    });

    it('rejects a whitespace-only logged_by (BR-12)', () => {
      expect(() => insertAction(db, { vehicleId, loggedBy: '   ' })).toThrow(/CHECK/);
    });

    it('requires an ISO-8601 UTC logged_at', () => {
      expect(() => insertAction(db, { vehicleId, loggedAt: '2026-10-07 09:00' })).toThrow(/CHECK/);
    });

    it('requires millisecond precision in logged_at (TA-12)', () => {
      insertAction(db, { vehicleId, loggedAt: '2026-10-07T09:00:00.000Z' });
      expect(() => insertAction(db, { vehicleId, loggedAt: '2026-10-07T09:00:00Z' })).toThrow(
        /CHECK/,
      );
      expect(() => insertAction(db, { vehicleId, loggedAt: '2026-10-07T09:00:00.0Z' })).toThrow(
        /CHECK/,
      );
      expect(() =>
        insertAction(db, { vehicleId, loggedAt: '2026-10-07T09:00:00.000+01:00' }),
      ).toThrow(/CHECK/);
    });
  });

  describe('vehicles constraints', () => {
    it('rejects an impossible stock-in date and a non-ISO date', () => {
      expect(() => insertVehicle(db, { dealershipId, stockInDate: '2026-13-01' })).toThrow(/CHECK/);
      expect(() => insertVehicle(db, { dealershipId, stockInDate: '2026-02-30' })).toThrow(/CHECK/);
      expect(() => insertVehicle(db, { dealershipId, stockInDate: '07/10/2026' })).toThrow(/CHECK/);
    });

    it('rejects a 16-char VIN', () => {
      expect(() => insertVehicle(db, { dealershipId, vin: 'A'.repeat(16) })).toThrow(/CHECK/);
    });

    it('rejects a duplicate VIN', () => {
      insertVehicle(db, { dealershipId, vin: '1FADP3F2XJL123456' });
      expect(() => insertVehicle(db, { dealershipId, vin: '1FADP3F2XJL123456' })).toThrow(/UNIQUE/);
    });

    it('rejects a duplicate stock number per dealership but allows it in another dealership', () => {
      insertVehicle(db, { dealershipId, stockNumber: 'STK-1042' });
      expect(() => insertVehicle(db, { dealershipId, stockNumber: 'STK-1042' })).toThrow(/UNIQUE/);
      const other = insertDealership(db);
      expect(insertVehicle(db, { dealershipId: other, stockNumber: 'STK-1042' })).toBeGreaterThan(
        0,
      );
    });

    it('enforces foreign keys', () => {
      expect(() => insertVehicle(db, { dealershipId: 999 })).toThrow(/FOREIGN KEY/);
      expect(() => insertAction(db, { vehicleId: 999 })).toThrow(/FOREIGN KEY/);
    });
  });

  describe('dealerships constraints', () => {
    it('rejects a lower-case or 2-letter currency and a duplicate name', () => {
      expect(() => insertDealership(db, { currency: 'gbp' })).toThrow(/CHECK/);
      expect(() => insertDealership(db, { currency: 'GB' })).toThrow(/CHECK/);
      insertDealership(db, { name: 'Leeds Northside Cars' });
      expect(() => insertDealership(db, { name: 'Leeds Northside Cars' })).toThrow(/UNIQUE/);
    });
  });

  describe('append-only history (BR-13)', () => {
    it('aborts UPDATE and DELETE on vehicle_actions', () => {
      const id = insertAction(db, { vehicleId });
      expect(() =>
        db.prepare("UPDATE vehicle_actions SET status = 'Under Review' WHERE id = ?").run(id),
      ).toThrow(/append-only/);
      expect(() => db.prepare('DELETE FROM vehicle_actions WHERE id = ?').run(id)).toThrow(
        /append-only/,
      );
      expect(count('vehicle_actions')).toBe(1);
    });
  });

  it('serves the default list order (age desc, stock number) from idx_vehicles_dealer_stockin', () => {
    const plan = db
      .prepare<[number], { detail: string }>(
        `EXPLAIN QUERY PLAN SELECT id FROM vehicles WHERE dealership_id = ?
         ORDER BY stock_in_date ASC, stock_number ASC, id ASC LIMIT 25 OFFSET 0`,
      )
      .all(dealershipId)
      .map((row) => row.detail)
      .join('\n');
    expect(plan).toContain('idx_vehicles_dealer_stockin');
    expect(plan).not.toContain('TEMP B-TREE');
  });
});
