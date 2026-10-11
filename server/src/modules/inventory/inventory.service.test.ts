import { openDatabase, type Db } from '../../db/connection';
import { migrate } from '../../db/migrate';
import { fixedClock, type Clock } from '../../lib/clock';
import { NotFoundError } from '../../lib/errors';
import { insertAction, insertDealership, insertVehicle } from '../../../test/factories';
import { createActionsRepository } from '../actions/actions.repository';
import { createDealershipsRepository } from '../dealerships/dealerships.repository';
import { createInventoryRepository } from './inventory.repository';
import { createInventoryService } from './inventory.service';

let db: Db;
let dealershipId: number;

beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
  dealershipId = insertDealership(db, { timeZone: 'Europe/London' });
});
afterEach(() => db.close());

function service(clock: Clock = fixedClock('2026-10-07')) {
  return createInventoryService({
    dealerships: createDealershipsRepository(db),
    inventory: createInventoryRepository(db),
    actions: createActionsRepository(db),
    clock,
  });
}
const defaults = { sort: 'age', page: 1, pageSize: 25 } as const;

describe('inventory service listVehicles', () => {
  it('derives age and aging at the 90/91 boundary (AC-003.1, AC-003.2)', () => {
    for (const ageDays of [0, 90, 91]) insertVehicle(db, { dealershipId, ageDays });

    const { items } = service().listVehicles(dealershipId, defaults);

    expect(items.map((v) => [v.stockInDate, v.daysInStock, v.isAging])).toEqual([
      ['2026-07-08', 91, true],
      ['2026-07-09', 90, false],
      ['2026-10-07', 0, false],
    ]);
  });

  it('turns 90 days into 91 / aging when the clock moves one day (AC-003.3)', () => {
    insertVehicle(db, { dealershipId, stockInDate: '2026-07-09' });

    const [today] = service(fixedClock('2026-10-07')).listVehicles(dealershipId, defaults).items;
    const [tomorrow] = service(fixedClock('2026-10-08')).listVehicles(dealershipId, defaults).items;

    expect([today?.daysInStock, today?.isAging]).toEqual([90, false]);
    expect([tomorrow?.daysInStock, tomorrow?.isAging]).toEqual([91, true]);
  });

  it('uses the dealership-local date late in the evening (AC-003.5)', () => {
    insertVehicle(db, { dealershipId, stockInDate: '2026-07-09' });
    const lateEvening: Clock = { now: () => new Date('2026-10-07T23:30:00Z') };

    const [vehicle] = service(lateEvening).listVehicles(dealershipId, defaults).items;

    expect([vehicle?.daysInStock, vehicle?.isAging]).toEqual([91, true]);
  });

  describe('in a dealership behind UTC (America/New_York, AC-003.5)', () => {
    let newYork: number;
    beforeEach(() => {
      newYork = insertDealership(db, { timeZone: 'America/New_York' });
      insertVehicle(db, { dealershipId: newYork, stockInDate: '2026-07-09' });
    });
    const at = (iso: string): Clock => ({ now: () => new Date(iso) });

    it('is still 90 days / not aging when the UTC date has already rolled over', () => {
      // 02:00 UTC on 8 Oct is 22:00 EDT on 7 Oct; a UTC-dated "today" would say 91 / aging
      const [vehicle] = service(at('2026-10-08T02:00:00.000Z')).listVehicles(
        newYork,
        defaults,
      ).items;

      expect([vehicle?.daysInStock, vehicle?.isAging, vehicle?.needsAttention]).toEqual([
        90,
        false,
        false,
      ]);
    });

    it('turns 91 / aging at local midnight, not UTC midnight', () => {
      const beforeLocalMidnight = service(at('2026-10-08T03:59:59.999Z')).listVehicles(
        newYork,
        defaults,
      ).items[0];
      const atLocalMidnight = service(at('2026-10-08T04:00:00.000Z')).listVehicles(
        newYork,
        defaults,
      ).items[0];

      expect([beforeLocalMidnight?.daysInStock, beforeLocalMidnight?.isAging]).toEqual([90, false]);
      expect([atLocalMidnight?.daysInStock, atLocalMidnight?.isAging]).toEqual([91, true]);
    });

    it('gives a London dealership a different "today" at the same instant', () => {
      insertVehicle(db, { dealershipId, stockInDate: '2026-07-09' });
      const clock = at('2026-10-08T02:00:00.000Z');

      const [london] = service(clock).listVehicles(dealershipId, defaults).items;
      const [ny] = service(clock).listVehicles(newYork, defaults).items;

      expect([london?.daysInStock, ny?.daysInStock]).toEqual([91, 90]);
    });
  });

  it('clamps a future stock-in date to 0 days', () => {
    insertVehicle(db, { dealershipId, stockInDate: '2026-10-20' });

    expect(service().listVehicles(dealershipId, defaults).items[0]?.daysInStock).toBe(0);
  });

  it('maps the current action and needsAttention (BR-14, BR-16)', () => {
    const withAction = insertVehicle(db, { dealershipId, ageDays: 120, stockNumber: 'STK-A' });
    insertVehicle(db, { dealershipId, ageDays: 100, stockNumber: 'STK-B' });
    const young = insertVehicle(db, { dealershipId, ageDays: 10, stockNumber: 'STK-C' });
    insertAction(db, {
      vehicleId: withAction,
      status: 'Price Reduction Planned',
      loggedBy: 'Jane Smith',
      loggedAt: '2026-10-06T10:00:00.000Z',
    });
    insertAction(db, { vehicleId: young });

    const { items } = service().listVehicles(dealershipId, defaults);

    expect(
      items.map((v) => [v.stockNumber, v.needsAttention, v.currentAction?.status ?? null]),
    ).toEqual([
      ['STK-A', false, 'Price Reduction Planned'],
      ['STK-B', true, null],
      ['STK-C', false, 'Under Review'],
    ]);
    expect(items[0]?.currentAction).toEqual({
      status: 'Price Reduction Planned',
      loggedBy: 'Jane Smith',
      loggedAt: '2026-10-06T10:00:00.000Z',
    });
  });

  it('defaults the order per sort key (TA-06): age desc, price asc', () => {
    insertVehicle(db, {
      dealershipId,
      ageDays: 5,
      listPriceMinor: 3_000_000,
      stockNumber: 'STK-1',
    });
    insertVehicle(db, {
      dealershipId,
      ageDays: 50,
      listPriceMinor: 1_000_000,
      stockNumber: 'STK-2',
    });
    insertVehicle(db, {
      dealershipId,
      ageDays: 20,
      listPriceMinor: 2_000_000,
      stockNumber: 'STK-3',
    });
    const list = (query: Parameters<ReturnType<typeof service>['listVehicles']>[1]) =>
      service()
        .listVehicles(dealershipId, query)
        .items.map((v) => v.stockNumber);

    expect(list(defaults)).toEqual(['STK-2', 'STK-3', 'STK-1']);
    expect(list({ ...defaults, order: 'asc' })).toEqual(['STK-1', 'STK-3', 'STK-2']);
    expect(list({ ...defaults, sort: 'price' })).toEqual(['STK-2', 'STK-3', 'STK-1']);
    expect(list({ ...defaults, sort: 'price', order: 'desc' })).toEqual([
      'STK-1',
      'STK-3',
      'STK-2',
    ]);
  });

  it('throws NotFoundError for an unknown dealership', () => {
    expect(() => service().listVehicles(dealershipId + 1, defaults)).toThrow(NotFoundError);
  });

  describe('filters (T-015)', () => {
    const stock = (
      query: Parameters<ReturnType<typeof service>['listVehicles']>[1],
      clock?: Clock,
    ) =>
      service(clock)
        .listVehicles(dealershipId, query)
        .items.map((v) => v.stockNumber);

    it('needsAttention = aging AND no action, ANDed with other filters (BR-16, BR-05)', () => {
      const actioned = insertVehicle(db, { dealershipId, ageDays: 200, stockNumber: 'STK-1' });
      insertVehicle(db, { dealershipId, ageDays: 91, make: 'Kia', stockNumber: 'STK-2' });
      insertVehicle(db, { dealershipId, ageDays: 95, make: 'Ford', stockNumber: 'STK-3' });
      insertVehicle(db, { dealershipId, ageDays: 90, make: 'Ford', stockNumber: 'STK-4' });
      insertAction(db, { vehicleId: actioned });

      expect(stock({ ...defaults, needsAttention: true })).toEqual(['STK-3', 'STK-2']);
      expect(stock({ ...defaults, needsAttention: true, make: 'Ford' })).toEqual(['STK-3']);
      expect(stock({ ...defaults, needsAttention: false })).toHaveLength(4);
      expect(stock({ ...defaults, needsAttention: true, ageBucket: '61-90' })).toEqual([]);
    });

    it('returns an empty page for an empty age intersection without failing (TA-07)', () => {
      insertVehicle(db, { dealershipId, ageDays: 10 });

      expect(
        service().listVehicles(dealershipId, { ...defaults, ageBucket: '0-30', minAge: 31 }),
      ).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
    });

    it('still 404s for an unknown dealership when the intersection is empty', () => {
      expect(() =>
        service().listVehicles(dealershipId + 1, {
          ...defaults,
          ageBucket: '0-30',
          agingOnly: true,
        }),
      ).toThrow(NotFoundError);
    });

    it('moves the bucket bounds with the clock: 90 joins over-90 the next day (BR-03)', () => {
      insertVehicle(db, { dealershipId, stockInDate: '2026-07-09', stockNumber: 'STK-90' });
      const query = { ...defaults, ageBucket: 'over-90' } as const;

      expect(stock(query, fixedClock('2026-10-07'))).toEqual([]);
      expect(stock(query, fixedClock('2026-10-08'))).toEqual(['STK-90']);
    });
  });
});

describe('inventory service getFacets', () => {
  it('groups distinct make/model pairs, both A-Z (BR-06)', () => {
    for (const [make, model] of [
      ['Kia', 'Niro'],
      ['Ford', 'Puma'],
      ['Ford', 'Fiesta'],
      ['Ford', 'Puma'],
    ] as const) {
      insertVehicle(db, { dealershipId, make, model });
    }

    expect(service().getFacets(dealershipId)).toEqual({
      makes: [
        { make: 'Ford', models: ['Fiesta', 'Puma'] },
        { make: 'Kia', models: ['Niro'] },
      ],
    });
  });

  it('throws NotFoundError for an unknown dealership', () => {
    expect(() => service().getFacets(dealershipId + 1)).toThrow(NotFoundError);
  });
});

describe('inventory service getSummary (T-022)', () => {
  const addVehicles = (ages: number[], id = dealershipId) =>
    ages.map((ageDays) => insertVehicle(db, { dealershipId: id, ageDays }));

  it('gives 8 / 3 / 37.5 / 75 for ages 10..200 (AC-005.1, TA-21: 601 / 8 = 75.125)', () => {
    addVehicles([10, 20, 30, 40, 90, 91, 120, 200]);

    expect(service().getSummary(dealershipId)).toEqual({
      asOfDate: '2026-10-07',
      totalVehicles: 8,
      agingCount: 3,
      agingPercent: 37.5,
      averageDaysInStock: 75,
      needsAttentionCount: 3,
    });
  });

  it('gives 0 / 0 / 0 / null for a dealership with no vehicles (AC-005.3)', () => {
    expect(service().getSummary(dealershipId)).toEqual({
      asOfDate: '2026-10-07',
      totalVehicles: 0,
      agingCount: 0,
      agingPercent: 0,
      averageDaysInStock: null,
      needsAttentionCount: 0,
    });
  });

  it('counts aging vehicles without an action as needing attention (AC-010.1, BR-16)', () => {
    const [acted, actedTwice] = addVehicles([91, 150, 200, 90]);
    insertAction(db, { vehicleId: acted! });
    insertAction(db, { vehicleId: actedTwice! });
    insertAction(db, { vehicleId: actedTwice!, loggedAt: '2026-10-07T11:00:00.000Z' });

    const summary = service().getSummary(dealershipId);

    expect([summary.agingCount, summary.needsAttentionCount]).toEqual([3, 1]);
  });

  it.each([
    ['2 of 3 rounds to 66.7', [91, 100, 10], 66.7],
    ['1 of 3 rounds to 33.3', [91, 0, 0], 33.3],
    ['1 of 8 is 12.5', [91, 0, 0, 0, 0, 0, 0, 0], 12.5],
    ['all aging is 100', [91, 200], 100],
  ])('rounds agingPercent to 1 dp: %s (TA-21)', (_label, ages, expected) => {
    addVehicles(ages);

    expect(service().getSummary(dealershipId).agingPercent).toBe(expected);
  });

  // Divide-first rounding (count / total * 1000) loses these to binary floating point:
  // 0.5025 * 1000 = 502.49999..., so a half-up 50.25 came out as 50.2.
  it.each([
    [201, 400, 50.3],
    [203, 400, 50.8],
    [1001, 2000, 50.1],
    [1, 16, 6.3],
    [1, 2001, 0],
    [2000, 2001, 100],
  ])(
    'rounds %i of %i aging half up to %s percent without float error (TA-21)',
    (aging, total, expected) => {
      db.transaction(() =>
        addVehicles(Array.from({ length: total }, (_, i) => (i < aging ? 91 : 0))),
      )();

      expect(service().getSummary(dealershipId).agingPercent).toBe(expected);
    },
  );

  it.each([
    ['exactly .5 rounds up', [0, 1], 1],
    ['90.5 rounds up to 91', [90, 91], 91],
    ['.33 rounds down', [91, 0, 0], 30],
  ])('rounds averageDaysInStock half up: %s (TA-21)', (_label, ages, expected) => {
    addVehicles(ages);

    expect(service().getSummary(dealershipId).averageDaysInStock).toBe(expected);
  });

  it('counts a future-dated vehicle as age 0 in the average (BR-01, TA-22)', () => {
    insertVehicle(db, { dealershipId, stockInDate: '2026-11-06' }); // 30 days ahead
    addVehicles([10]);

    expect(service().getSummary(dealershipId)).toMatchObject({
      totalVehicles: 2,
      averageDaysInStock: 5,
    });
  });

  it("only counts the dealership's own stock (BR-04)", () => {
    const other = insertDealership(db);
    addVehicles([200, 200, 200], other);
    addVehicles([10]);

    expect(service().getSummary(dealershipId)).toMatchObject({
      totalVehicles: 1,
      agingCount: 0,
      averageDaysInStock: 10,
    });
  });

  it('turns 90 days into aging when the clock moves one day (BR-03)', () => {
    insertVehicle(db, { dealershipId, stockInDate: '2026-07-09' });

    const today = service(fixedClock('2026-10-07')).getSummary(dealershipId);
    const tomorrow = service(fixedClock('2026-10-08')).getSummary(dealershipId);

    expect([today.asOfDate, today.agingCount, today.averageDaysInStock]).toEqual([
      '2026-10-07',
      0,
      90,
    ]);
    expect([tomorrow.asOfDate, tomorrow.agingCount, tomorrow.averageDaysInStock]).toEqual([
      '2026-10-08',
      1,
      91,
    ]);
  });

  it('uses the dealership-local date late in the evening (TA-01, AC-003.5)', () => {
    // 23:30 UTC on 7 Oct is 00:30 BST on 8 Oct in London, but 19:30 EDT on 7 Oct in New York
    const newYork = insertDealership(db, { timeZone: 'America/New_York' });
    insertVehicle(db, { dealershipId, stockInDate: '2026-07-09' });
    insertVehicle(db, { dealershipId: newYork, stockInDate: '2026-07-09' });
    const lateEvening: Clock = { now: () => new Date('2026-10-07T23:30:00Z') };

    const london = service(lateEvening).getSummary(dealershipId);
    const ny = service(lateEvening).getSummary(newYork);

    expect([london.asOfDate, london.agingCount, london.averageDaysInStock]).toEqual([
      '2026-10-08',
      1,
      91,
    ]);
    expect([ny.asOfDate, ny.agingCount, ny.averageDaysInStock]).toEqual(['2026-10-07', 0, 90]);
  });

  it('throws NotFoundError for an unknown dealership', () => {
    expect(() => service().getSummary(dealershipId + 1)).toThrow(NotFoundError);
  });
});

describe('inventory service getVehicle / getVehicleDetail (T-026)', () => {
  it('derives the same fields as the list item (age, aging, current action)', () => {
    const vehicleId = insertVehicle(db, { dealershipId, ageDays: 91 });
    insertAction(db, { vehicleId, loggedAt: '2026-10-07T09:00:00.000Z' });

    const [listed] = service().listVehicles(dealershipId, defaults).items;

    expect(service().getVehicle(vehicleId)).toEqual(listed);
    expect(listed).toMatchObject({ daysInStock: 91, isAging: true, needsAttention: false });
  });

  it('uses the dealership-local today: 23:30 UTC is already the next day in BST', () => {
    const vehicleId = insertVehicle(db, { dealershipId, stockInDate: '2026-07-09' });
    const lateEvening = { now: () => new Date('2026-10-07T23:30:00.000Z') };

    expect(service(lateEvening).getVehicle(vehicleId)).toMatchObject({
      daysInStock: 91,
      isAging: true,
    });
    expect(service().getVehicle(vehicleId)).toMatchObject({ daysInStock: 90, isAging: false });
  });

  it('adds currency, time zone and the history newest first, id breaking timestamp ties', () => {
    const vehicleId = insertVehicle(db, { dealershipId, ageDays: 120 });
    const first = insertAction(db, { vehicleId, loggedAt: '2026-10-07T12:00:00.000Z' });
    const second = insertAction(db, { vehicleId, loggedAt: '2026-10-07T12:00:00.000Z' });
    const older = insertAction(db, { vehicleId, loggedAt: '2026-10-06T08:00:00.000Z' });

    const detail = service().getVehicleDetail(vehicleId);

    expect(detail).toMatchObject({ currency: 'GBP', timeZone: 'Europe/London' });
    expect(detail.actions.map((a) => a.id)).toEqual([second, first, older]);
  });

  it('throws NotFoundError for an unknown vehicle', () => {
    expect(() => service().getVehicle(999)).toThrow(NotFoundError);
    expect(() => service().getVehicleDetail(999)).toThrow(NotFoundError);
  });
});
