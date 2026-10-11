import type { CreateActionBody } from '@shared/api/actions';
import { openDatabase, type Db } from '../../db/connection';
import { migrate } from '../../db/migrate';
import { fixedClock, type Clock } from '../../lib/clock';
import { BusinessRuleError, NotFoundError } from '../../lib/errors';
import { insertDealership, insertVehicle } from '../../../test/factories';
import { createDealershipsRepository } from '../dealerships/dealerships.repository';
import { createInventoryRepository } from '../inventory/inventory.repository';
import { createInventoryService } from '../inventory/inventory.service';
import { createActionsRepository } from './actions.repository';
import { createActionsService } from './actions.service';

let db: Db;
let dealershipId: number;

beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
  dealershipId = insertDealership(db, { timeZone: 'Europe/London' });
});
afterEach(() => db.close());

function service(clock: Clock = fixedClock('2026-10-07')) {
  const actions = createActionsRepository(db);
  return createActionsService({
    vehicles: createInventoryService({
      dealerships: createDealershipsRepository(db),
      inventory: createInventoryRepository(db),
      actions,
      clock,
    }),
    actions,
    clock,
  });
}
const storedCount = () => db.prepare('SELECT COUNT(*) FROM vehicle_actions').pluck().get();
const body: CreateActionBody = {
  status: 'Price Reduction Planned',
  note: 'Reduce by 5%',
  loggedBy: 'Jane Smith',
};
const at = (iso: string): Clock => ({ now: () => new Date(iso) });

describe('actions service logAction', () => {
  describe('BR-09: only aging vehicles (strictly more than 90 days)', () => {
    it('rejects a 90-day vehicle with VEHICLE_NOT_AGING and stores nothing', () => {
      const vehicleId = insertVehicle(db, { dealershipId, ageDays: 90 });

      let error: unknown;
      try {
        service().logAction(vehicleId, body);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(BusinessRuleError);
      expect(error).toMatchObject({
        statusCode: 422,
        code: 'VEHICLE_NOT_AGING',
        details: { daysInStock: 90 },
      });
      expect(storedCount()).toBe(0);
    });

    it('accepts a 91-day vehicle', () => {
      const vehicleId = insertVehicle(db, { dealershipId, ageDays: 91 });

      expect(service().logAction(vehicleId, body)).toMatchObject({ vehicleId, ...body });
      expect(storedCount()).toBe(1);
    });

    it('re-derives aging from the clock: the next day turns 90 into 91 (BR-03)', () => {
      const vehicleId = insertVehicle(db, { dealershipId, ageDays: 90 });

      expect(() => service().logAction(vehicleId, body)).toThrow(BusinessRuleError);
      expect(service(fixedClock('2026-10-08')).logAction(vehicleId, body).vehicleId).toBe(
        vehicleId,
      );
    });

    it('uses the dealership-local date like the list (23:30 UTC is the next day in BST)', () => {
      const vehicleId = insertVehicle(db, { dealershipId, stockInDate: '2026-07-09' });

      expect(() => service(at('2026-10-07T22:59:59.999Z')).logAction(vehicleId, body)).toThrow(
        BusinessRuleError,
      );
      expect(service(at('2026-10-07T23:30:00.000Z')).logAction(vehicleId, body).loggedAt).toBe(
        '2026-10-07T23:30:00.000Z',
      );
    });

    it('treats a future-dated vehicle as age 0, not aging', () => {
      const vehicleId = insertVehicle(db, { dealershipId, stockInDate: '2027-01-01' });

      expect(() => service().logAction(vehicleId, body)).toThrow(BusinessRuleError);
      expect(storedCount()).toBe(0);
    });
  });

  it('throws NotFoundError for an unknown vehicle and stores nothing', () => {
    expect(() => service().logAction(999, body)).toThrow(NotFoundError);
    expect(storedCount()).toBe(0);
  });

  it('assigns loggedAt from the clock as ISO UTC with milliseconds (BR-13, TA-12)', () => {
    const vehicleId = insertVehicle(db, { dealershipId, ageDays: 120 });

    expect(service(at('2026-10-07T13:32:05.123Z')).logAction(vehicleId, body).loggedAt).toBe(
      '2026-10-07T13:32:05.123Z',
    );
    expect(service().logAction(vehicleId, body).loggedAt).toBe('2026-10-07T12:00:00.000Z');
  });

  it.each([
    ['omitted', undefined],
    ['empty', ''],
    ['whitespace-only', ' \t  '],
    ['zero-width-space-only', ' \u200B\u2060 '],
  ])('stores an %s note as null (TA-17)', (_label, note) => {
    const vehicleId = insertVehicle(db, { dealershipId, ageDays: 120 });

    const entry = service().logAction(vehicleId, { ...body, note });

    expect(entry.note).toBeNull();
    expect(db.prepare('SELECT note FROM vehicle_actions').pluck().get()).toBeNull();
  });

  it('trims the note and the name even when called without the HTTP schema (BR-18)', () => {
    const vehicleId = insertVehicle(db, { dealershipId, ageDays: 120 });

    const entry = service().logAction(vehicleId, {
      ...body,
      note: '  Reduce by 5%  ',
      loggedBy: '  Jane Smith ',
    });

    expect(entry).toMatchObject({ note: 'Reduce by 5%', loggedBy: 'Jane Smith' });
  });

  it('returns the stored row with its id; entries only accumulate (BR-13)', () => {
    const vehicleId = insertVehicle(db, { dealershipId, ageDays: 120 });

    const first = service().logAction(vehicleId, body);
    const second = service().logAction(vehicleId, { ...body, status: 'Under Review' });

    expect(second.id).toBeGreaterThan(first.id);
    expect(createActionsRepository(db).listByVehicle(vehicleId)).toEqual([second, first]);
  });
});
