import { ACTION_STATUSES, type ActionStatus } from '@shared/api/actions';
import type { Db } from '../../db/connection';
import type { Seeder } from '../../db/seed';
import type { Clock } from '../../lib/clock';
import { addDays, localDate, zonedTimeToInstant } from '../../lib/dates';
import {
  ACTION_NOTES,
  BOUNDARY_AGES,
  BUCKET_WEIGHTS,
  CATALOGUE,
  COLOURS,
  DEMO_DEALERSHIPS,
  FIRST_STOCK_NUMBER,
  LOGGED_BY_NAMES,
  MODEL_YEARS,
  PRICE_POUNDS,
  PRNG_SEED,
  SEARCH_DEMO_VEHICLE,
  VIN_ALPHABET,
} from './inventory.seed-data';
import { createPrng, type Prng } from './prng';

/**
 * Deterministic demo data (TRD 4.5, NFR-09): same clock -> same rows. Every date is relative to
 * the dealership-local "today" at seed time, so exact boundary ages (90/91) exist on that day.
 */

type Role = 'random' | 'boundary' | 'sameDayHistory' | 'markupNote' | 'longNote' | 'nonAging';
type PlannedVehicle = { age: number; role: Role };
type ActionPlan = {
  daysAgo: number;
  time: string;
  status: ActionStatus;
  note: string | null;
  loggedBy: string;
};

const LONG_NOTE = (() => {
  const sentence = 'Auction house valuation requested; reserve agreed with the regional manager. ';
  return `${sentence.repeat(10).slice(0, 499)}.`;
})();

/** Exact roles on the default dealership's boundary vehicles (AC-007.4, AC-006.8, A-15). */
const DEFAULT_DEALERSHIP_ROLES: Partial<Record<number, Role>> = {
  120: 'markupNote',
  200: 'sameDayHistory',
  365: 'longNote',
};

const SPECIAL_HISTORIES: Record<Exclude<Role, 'random' | 'boundary'>, ActionPlan[]> = {
  sameDayHistory: [
    {
      daysAgo: 2,
      time: '09:00',
      status: 'Under Review',
      note: 'Checking comparable listings.',
      loggedBy: 'Tom Hughes',
    },
    {
      daysAgo: 2,
      time: '11:00',
      status: 'Marketing Promotion',
      note: 'Featured in the weekend email.',
      loggedBy: 'Jane Smith',
    },
  ],
  markupNote: [
    {
      daysAgo: 5,
      time: '14:30',
      status: 'Price Reduction Planned',
      note: 'Agreed <b>cut</b> of £500 with the sales manager.',
      loggedBy: 'Priya Patel',
    },
  ],
  longNote: [
    {
      daysAgo: 3,
      time: '10:15',
      status: 'Send to Auction/Wholesale',
      note: LONG_NOTE,
      loggedBy: 'Mark Davies',
    },
  ],
  nonAging: [
    {
      daysAgo: 10,
      time: '16:45',
      status: 'Under Review',
      note: 'Logged before the stock-in date was corrected.',
      loggedBy: 'Sophie Clarke',
    },
  ],
};

function planAges(rng: Prng, count: number, isDefault: boolean): PlannedVehicle[] {
  if (count === 0) return [];
  const fixed: PlannedVehicle[] = BOUNDARY_AGES.map((age) => ({
    age,
    role: (isDefault && DEFAULT_DEALERSHIP_ROLES[age]) || 'boundary',
  }));
  if (isDefault) fixed.push({ age: 45, role: 'nonAging' });

  const spread: PlannedVehicle[] = [];
  for (let i = fixed.length; i < count; i++) {
    let roll = rng.next();
    const bucket =
      BUCKET_WEIGHTS.find((b) => (roll -= b.share) < 0) ??
      BUCKET_WEIGHTS[BUCKET_WEIGHTS.length - 1];
    spread.push({ age: rng.int(bucket?.min ?? 0, bucket?.max ?? 0), role: 'random' });
  }
  return rng.shuffle([...fixed, ...spread]);
}

function randomVin(rng: Prng, used: Set<string>): string {
  for (;;) {
    const vin = Array.from({ length: 17 }, () => rng.pick([...VIN_ALPHABET])).join('');
    if (!used.has(vin) && !vin.includes('123456')) {
      used.add(vin);
      return vin;
    }
  }
}

function buildVehicle(rng: Prng, stockInDate: string, usedVins: Set<string>) {
  const { make, models } = rng.pick(CATALOGUE);
  const { model, trims, newPricePounds } = rng.pick(models);
  const stockInYear = Number(stockInDate.slice(0, 4));
  const newestYear = Math.max(MODEL_YEARS.min, Math.min(MODEL_YEARS.max, stockInYear + 1));
  const modelYear = rng.int(MODEL_YEARS.min, newestYear);
  const carAge = Math.max(0, stockInYear - modelYear);
  const mileage = carAge * rng.int(5_000, 11_000) + rng.int(10, 900);
  const value = newPricePounds * 0.85 ** carAge * (0.95 + rng.next() * 0.1);
  const pounds = Math.round(value / 100) * 100 - rng.pick([10, 5]);
  const clamped = Math.min(PRICE_POUNDS.max, Math.max(PRICE_POUNDS.min, pounds));
  return {
    vin: randomVin(rng, usedVins),
    make,
    model,
    modelYear,
    trim: rng.pick(trims),
    colour: rng.pick(COLOURS),
    mileage,
    listPriceMinor: clamped * 100,
  };
}

/**
 * 1-3 entries on distinct past days while the vehicle was already aging (age > 90 on the log
 * date, BR-09), oldest first. `daysAgo` d means the vehicle was `age - d` days old, so d <= age - 91.
 */
function randomHistory(rng: Prng, age: number): ActionPlan[] {
  const maxDaysAgo = Math.min(30, age - 91);
  if (maxDaysAgo <= 0) return [];
  const count = Math.min(rng.int(1, 3), maxDaysAgo);
  const days = rng
    .shuffle(Array.from({ length: maxDaysAgo }, (_, i) => i + 1))
    .slice(0, count)
    .sort((a, b) => b - a);
  return days.map((daysAgo) => ({
    daysAgo,
    time: `${String(rng.int(8, 17)).padStart(2, '0')}:${rng.pick(['00', '15', '30', '45'])}`,
    status: rng.pick(ACTION_STATUSES),
    note: rng.chance(0.6) ? rng.pick(ACTION_NOTES) : null,
    loggedBy: rng.pick(LOGGED_BY_NAMES),
  }));
}

function seedInventory(db: Db, clock: Clock) {
  const rng = createPrng(PRNG_SEED);
  const now = clock.now();
  const insertDealership = db.prepare(
    'INSERT INTO dealerships (name, currency, time_zone) VALUES (?, ?, ?)',
  );
  const insertVehicle = db.prepare(
    `INSERT INTO vehicles (dealership_id, vin, stock_number, make, model, model_year, trim_level,
       colour, mileage, list_price_minor, stock_in_date)
     VALUES (@dealershipId, @vin, @stockNumber, @make, @model, @modelYear, @trim, @colour,
       @mileage, @listPriceMinor, @stockInDate)`,
  );
  const insertAction = db.prepare(
    'INSERT INTO vehicle_actions (vehicle_id, status, note, logged_by, logged_at) VALUES (?, ?, ?, ?, ?)',
  );
  const usedVins = new Set<string>([SEARCH_DEMO_VEHICLE.vin]);
  let stockSequence = FIRST_STOCK_NUMBER;

  DEMO_DEALERSHIPS.forEach((dealership, index) => {
    // Also validates the IANA zone (RangeError for an unknown one), TA-01
    const today = localDate(now, dealership.timeZone);
    const dealershipId = Number(
      insertDealership.run(dealership.name, dealership.currency, dealership.timeZone)
        .lastInsertRowid,
    );
    const isDefault = index === 0;

    for (const { age, role } of planAges(rng, dealership.vehicleCount, isDefault)) {
      const stockNumber = `STK-${stockSequence++}`;
      const stockInDate = addDays(today, -age);
      const generated = buildVehicle(rng, stockInDate, usedVins);
      // The search demo vehicle replaces the generated attributes wholesale; the generator still
      // runs so the PRNG sequence (and every other row) is unchanged.
      const vehicle =
        isDefault && stockNumber === SEARCH_DEMO_VEHICLE.stockNumber
          ? { ...generated, ...SEARCH_DEMO_VEHICLE }
          : { ...generated, stockNumber };
      const vehicleId = Number(
        insertVehicle.run({ ...vehicle, dealershipId, stockInDate }).lastInsertRowid,
      );

      let history: ActionPlan[] = [];
      if (role === 'random') {
        if (age > 90 && rng.chance(dealership.actionShare)) history = randomHistory(rng, age);
      } else if (role !== 'boundary') {
        history = SPECIAL_HISTORIES[role];
      }
      for (const entry of history) {
        const loggedAt = zonedTimeToInstant(
          addDays(today, -entry.daysAgo),
          entry.time,
          dealership.timeZone,
        ).toISOString();
        insertAction.run(vehicleId, entry.status, entry.note, entry.loggedBy, loggedAt);
      }
    }
  });
}

export const inventorySeeder: Seeder = {
  name: 'inventory',
  isSeeded: (db) => db.prepare('SELECT 1 FROM dealerships LIMIT 1').get() !== undefined,
  run: seedInventory,
};
