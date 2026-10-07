import { ACTION_STATUSES } from '@shared/api/actions';
import { openDatabase, type Db } from '../../db/connection';
import { migrate } from '../../db/migrate';
import { seedIfEmpty, seeders } from '../../db/seed';
import { fixedClock, type Clock } from '../../lib/clock';
import { daysBetween, localDate } from '../../lib/dates';
import { createPrng } from './prng';
import { inventorySeeder } from './inventory.seed';
import { CATALOGUE, DEMO_DEALERSHIPS } from './inventory.seed-data';

type VehicleRow = {
  id: number;
  dealershipId: number;
  dealership: string;
  timeZone: string;
  vin: string;
  stockNumber: string;
  make: string;
  model: string;
  modelYear: number;
  trim: string;
  mileage: number;
  listPriceMinor: number;
  stockInDate: string;
  age: number;
};
type ActionRow = {
  id: number;
  vehicleId: number;
  status: string;
  note: string | null;
  loggedBy: string;
  loggedAt: string;
};

const clock = fixedClock('2026-10-07');
const TODAY = '2026-10-07';

function seeded(at: Clock = clock): Db {
  const db = openDatabase(':memory:');
  migrate(db);
  seedIfEmpty(db, at, [inventorySeeder]);
  return db;
}

function vehicles(db: Db): VehicleRow[] {
  return db
    .prepare<[string], VehicleRow>(
      `SELECT v.id, v.dealership_id AS dealershipId, d.name AS dealership, d.time_zone AS timeZone,
         v.vin, v.stock_number AS stockNumber, v.make, v.model, v.model_year AS modelYear,
         v.trim_level AS trim, v.mileage, v.list_price_minor AS listPriceMinor, v.stock_in_date AS stockInDate,
         CAST(julianday(?) - julianday(v.stock_in_date) AS INTEGER) AS age
       FROM vehicles v JOIN dealerships d ON d.id = v.dealership_id ORDER BY v.id`,
    )
    .all(TODAY);
}

function actions(db: Db, vehicleId?: number): ActionRow[] {
  const sql = `SELECT id, vehicle_id AS vehicleId, status, note, logged_by AS loggedBy,
                 logged_at AS loggedAt FROM vehicle_actions`;
  return vehicleId === undefined
    ? db.prepare<[], ActionRow>(`${sql} ORDER BY id`).all()
    : db.prepare<[number], ActionRow>(`${sql} WHERE vehicle_id = ? ORDER BY id`).all(vehicleId);
}

let db: Db;
let rows: VehicleRow[];
beforeAll(() => {
  db = seeded();
  rows = vehicles(db);
});
afterAll(() => db.close());

const inDealership = (name: string) => rows.filter((v) => v.dealership === name);

describe('createPrng (mulberry32)', () => {
  it('is deterministic for a seed and stays within bounds', () => {
    const a = createPrng(42);
    const b = createPrng(42);
    const sequence = Array.from({ length: 50 }, () => a.next());
    expect(Array.from({ length: 50 }, () => b.next())).toEqual(sequence);
    expect(sequence.every((n) => n >= 0 && n < 1)).toBe(true);
    const ints = Array.from({ length: 200 }, () => a.int(3, 5));
    expect(new Set(ints)).toEqual(new Set([3, 4, 5]));
    expect(() => a.pick([])).toThrow(/empty/);
  });
});

describe('inventorySeeder', () => {
  it('is registered as the app seeder', () => {
    expect(seeders).toEqual([inventorySeeder]);
  });

  it('creates the four demo dealerships with 360 / 220 / 150 / 0 vehicles', () => {
    const counts = db
      .prepare<[], { name: string; total: number }>(
        `SELECT d.name, COUNT(v.id) AS total FROM dealerships d
         LEFT JOIN vehicles v ON v.dealership_id = d.id GROUP BY d.id ORDER BY d.name`,
      )
      .all();
    expect(counts).toEqual([
      { name: 'Birmingham Central Motors', total: 360 },
      { name: 'Leeds Northside Cars', total: 220 },
      { name: 'Manchester Quays Autos', total: 150 },
      { name: 'York Pop-up Showroom', total: 0 },
    ]);
    expect(DEMO_DEALERSHIPS.every((d) => d.currency === 'GBP')).toBe(true);
  });

  it.each(['Birmingham Central Motors', 'Leeds Northside Cars', 'Manchester Quays Autos'])(
    '%s has the exact boundary ages and every bucket',
    (name) => {
      const ages = new Set(inDealership(name).map((v) => v.age));
      for (const age of [0, 30, 31, 60, 61, 90, 91, 120, 200, 365]) expect(ages).toContain(age);
      const buckets = [
        [0, 30],
        [31, 60],
        [61, 90],
        [91, 400],
      ] as const;
      for (const [min, max] of buckets) {
        expect(
          inDealership(name).filter((v) => v.age >= min && v.age <= max).length,
        ).toBeGreaterThan(5);
      }
      expect(Math.max(...ages)).toBeLessThanOrEqual(400);
      expect(Math.min(...ages)).toBeGreaterThanOrEqual(0);
    },
  );

  it('has more than one page of aging vehicles in Birmingham', () => {
    const aging = inDealership('Birmingham Central Motors').filter((v) => v.age > 90);
    expect(aging.length).toBeGreaterThan(25);
  });

  it('contains STK-1042 / 1FADP3F2XJL123456 in Birmingham (AC-002.6)', () => {
    const match = rows.filter((v) => v.stockNumber === 'STK-1042');
    expect(match).toHaveLength(1);
    expect(match[0]).toMatchObject({
      dealership: 'Birmingham Central Motors',
      vin: '1FADP3F2XJL123456',
      make: 'Ford',
    });
    expect(rows.filter((v) => v.vin.includes('123456'))).toHaveLength(1);
  });

  it('pins STK-1042 to a realistic 2018 Ford Focus (trim, price, mileage)', () => {
    const focusTrims = CATALOGUE.find((m) => m.make === 'Ford')?.models.find(
      (m) => m.model === 'Focus',
    )?.trims;
    const vehicle = rows.find((v) => v.stockNumber === 'STK-1042');
    expect(vehicle).toMatchObject({
      model: 'Focus',
      modelYear: 2018,
      trim: 'Titanium',
      mileage: 58_240,
      listPriceMinor: 1_099_000,
    });
    expect(focusTrims).toContain(vehicle?.trim);
  });

  it('generates realistic, unique attributes', () => {
    expect(new Set(rows.map((v) => v.vin)).size).toBe(rows.length);
    expect(new Set(rows.map((v) => v.stockNumber)).size).toBe(rows.length);
    expect(rows.every((v) => /^[A-HJ-NPR-Z0-9]{17}$/.test(v.vin))).toBe(true);
    expect(rows.every((v) => /^STK-\d{4}$/.test(v.stockNumber))).toBe(true);
    expect(rows.every((v) => v.modelYear >= 2018 && v.modelYear <= 2026)).toBe(true);
    const pounds = rows.map((v) => v.listPriceMinor / 100);
    expect(pounds.every((p) => Number.isInteger(p) && p >= 7990 && p <= 54990)).toBe(true);
    expect(pounds.every((p) => p % 100 === 90 || p % 100 === 95)).toBe(true);
    expect(new Set(rows.map((v) => v.make)).size).toBeGreaterThanOrEqual(12);
  });

  it('logs the 09:00 "Under Review" and 11:00 "Marketing Promotion" entries on one day (AC-007.4)', () => {
    const local = (iso: string) =>
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    const vehicle = inDealership('Birmingham Central Motors').find((v) => {
      const history = actions(db, v.id);
      return (
        history.length === 2 &&
        history[0]?.status === 'Under Review' &&
        history[1]?.status === 'Marketing Promotion'
      );
    });
    expect(vehicle).toBeDefined();
    const [first, second] = actions(db, vehicle?.id);
    expect(local(first?.loggedAt ?? '')).toBe('09:00');
    expect(local(second?.loggedAt ?? '')).toBe('11:00');
    expect(localDate(new Date(first?.loggedAt ?? ''), 'Europe/London')).toBe(
      localDate(new Date(second?.loggedAt ?? ''), 'Europe/London'),
    );
  });

  it('includes a markup note, a 500-char note and a non-aging (age 45) vehicle with history', () => {
    const all = actions(db);
    expect(all.some((a) => a.note?.includes('<b>cut</b>'))).toBe(true);
    expect(all.some((a) => a.note?.length === 500)).toBe(true);
    const nonAging = inDealership('Birmingham Central Motors').filter(
      (v) => v.age === 45 && actions(db, v.id).length > 0,
    );
    expect(nonAging.length).toBeGreaterThanOrEqual(1);
  });

  it('only logs valid actions in the past, after stock-in, for Birmingham and Leeds', () => {
    const all = actions(db);
    const byId = new Map(rows.map((v) => [v.id, v]));
    // The one intentional exception (A-15): the age-45 vehicle whose history predates a correction
    const a15 = inDealership('Birmingham Central Motors').filter(
      (v) => v.age === 45 && actions(db, v.id).length > 0,
    );
    expect(a15).toHaveLength(1);
    for (const action of all) {
      const vehicle = byId.get(action.vehicleId);
      if (!vehicle) throw new Error(`Orphan action ${action.id}`);
      const loggedOn = localDate(new Date(action.loggedAt), vehicle.timeZone);
      expect(ACTION_STATUSES).toContain(action.status);
      expect(action.loggedAt <= clock.now().toISOString()).toBe(true);
      expect(loggedOn >= vehicle.stockInDate).toBe(true);
      expect(['Birmingham Central Motors', 'Leeds Northside Cars']).toContain(vehicle.dealership);
      if (vehicle.id !== a15[0]?.id) {
        // BR-09: the vehicle was already aging (> 90 days) on the dealership-local log date
        expect(
          daysBetween(vehicle.stockInDate, loggedOn),
          `${vehicle.stockNumber} action ${action.id} on ${loggedOn}`,
        ).toBeGreaterThan(90);
      }
    }
  });

  it('leaves aging vehicles without an action, so "Needs attention" is non-zero', () => {
    for (const name of ['Birmingham Central Motors', 'Leeds Northside Cars']) {
      const aging = inDealership(name).filter((v) => v.age > 90);
      const withAction = aging.filter((v) => actions(db, v.id).length > 0);
      expect(withAction.length / aging.length).toBeGreaterThan(0.25);
      expect(withAction.length).toBeLessThan(aging.length);
    }
  });

  it('produces identical rows on two runs with the same clock', () => {
    const again = seeded();
    expect(vehicles(again)).toEqual(rows);
    expect(actions(again)).toEqual(actions(db));
    again.close();
  });

  it('generates dates relative to the clock', () => {
    const later = seeded(fixedClock('2027-01-15'));
    const latest = later
      .prepare<[], string>('SELECT max(stock_in_date) FROM vehicles')
      .pluck()
      .get();
    expect(latest).toBe('2027-01-15');
    later.close();
  });

  it('is a no-op once dealerships exist', () => {
    expect(inventorySeeder.isSeeded(db)).toBe(true);
    expect(seedIfEmpty(db, clock, [inventorySeeder])).toEqual([]);
    expect(vehicles(db)).toHaveLength(730);
  });
});
