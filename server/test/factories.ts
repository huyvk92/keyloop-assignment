import type { ActionStatus } from '@shared/api/actions';
import type { Db } from '../src/db/connection';
import { addDays } from '../src/lib/dates';

/**
 * Test-data builders that write straight to SQLite (no seeder), so each test controls its rows.
 * Ids, names, VINs and stock numbers are unique per process via a counter.
 */
let sequence = 0;
const next = () => ++sequence;

type DealershipInput = { name?: string; currency?: string; timeZone?: string };

export function insertDealership(db: Db, input: DealershipInput = {}): number {
  const n = next();
  const result = db
    .prepare('INSERT INTO dealerships (name, currency, time_zone) VALUES (?, ?, ?)')
    .run(
      input.name ?? `Dealership ${n}`,
      input.currency ?? 'GBP',
      input.timeZone ?? 'Europe/London',
    );
  return Number(result.lastInsertRowid);
}

type VehicleInput = {
  dealershipId: number;
  /** Age in days relative to `today` (ignored when `stockInDate` is given). */
  ageDays?: number;
  stockInDate?: string;
  today?: string;
  vin?: string;
  stockNumber?: string;
  make?: string;
  model?: string;
  modelYear?: number;
  trim?: string;
  colour?: string;
  mileage?: number;
  listPriceMinor?: number;
};

export function insertVehicle(db: Db, input: VehicleInput): number {
  const n = next();
  const stockInDate =
    input.stockInDate ?? addDays(input.today ?? '2026-10-07', -(input.ageDays ?? 0));
  const result = db
    .prepare(
      `INSERT INTO vehicles (dealership_id, vin, stock_number, make, model, model_year, trim_level,
         colour, mileage, list_price_minor, stock_in_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.dealershipId,
      input.vin ?? `TESTVIN${String(n).padStart(10, '0')}`,
      input.stockNumber ?? `STK-${String(n).padStart(5, '0')}`,
      input.make ?? 'Ford',
      input.model ?? 'Focus',
      input.modelYear ?? 2022,
      input.trim ?? 'Titanium',
      input.colour ?? 'Blue',
      input.mileage ?? 12_345,
      input.listPriceMinor ?? 2_599_000,
      stockInDate,
    );
  return Number(result.lastInsertRowid);
}

type ActionInput = {
  vehicleId: number;
  status?: ActionStatus;
  note?: string | null;
  loggedBy?: string;
  loggedAt?: string;
};

export function insertAction(db: Db, input: ActionInput): number {
  const result = db
    .prepare(
      'INSERT INTO vehicle_actions (vehicle_id, status, note, logged_by, logged_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(
      input.vehicleId,
      input.status ?? 'Under Review',
      input.note ?? null,
      input.loggedBy ?? 'Jane Smith',
      input.loggedAt ?? '2026-10-07T09:00:00.000Z',
    );
  return Number(result.lastInsertRowid);
}
