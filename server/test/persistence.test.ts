import { ActionEntrySchema } from '@shared/api/actions';
import { DealershipListResponseSchema } from '@shared/api/dealerships';
import {
  InventorySummarySchema,
  VehicleDetailSchema,
  VehicleListResponseSchema,
} from '@shared/api/vehicles';
import type { FastifyInstance } from 'fastify';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app';
import { openDatabase, type Db } from '../src/db/connection';
import { migrate } from '../src/db/migrate';
import { seedIfEmpty } from '../src/db/seed';
import { fixedClock } from '../src/lib/clock';

/**
 * T-028 (AC-007.2, AC-007.3, NFR-04) on a real file database, with the seeded demo data.
 *
 * `start()` runs the same startup steps as server.ts, in the same order: open the database,
 * migrate, `seedIfEmpty(db, clock)` with the real seeders, build the app. A "restart" is
 * `stop()` (close the app, then the database, like the graceful shutdown) followed by `start()`
 * on the same file. Two concurrent `start()`s are two separately built servers, each with its own
 * connection: a second user's session.
 */
const clock = fixedClock('2026-10-07');

async function start(path: string) {
  const db = openDatabase(path);
  const applied = migrate(db);
  const seeded = seedIfEmpty(db, clock);
  const app = await buildApp(
    { db, clock, config: { CORS_ORIGIN: 'http://localhost:5173' } },
    { logger: false },
  );
  await app.ready();
  return {
    app,
    db,
    applied,
    seeded,
    stop: async () => {
      await app.close();
      db.close();
    },
  };
}

async function getJson(app: FastifyInstance, url: string): Promise<unknown> {
  const response = await app.inject({ method: 'GET', url: `/api${url}` });
  expect(response.statusCode).toBe(200);
  const body: unknown = response.json();
  return body;
}

/** What one server sees for a vehicle: its detail, its list row and the KPI count. */
async function readBack(app: FastifyInstance, dealershipId: number, vehicleId: number) {
  const detail = VehicleDetailSchema.parse(await getJson(app, `/vehicles/${vehicleId}`));
  const list = VehicleListResponseSchema.parse(
    await getJson(app, `/dealerships/${dealershipId}/vehicles?pageSize=100&sort=age`),
  );
  const summary = InventorySummarySchema.parse(
    await getJson(app, `/dealerships/${dealershipId}/summary`),
  );
  return {
    detail,
    listItem: list.items.find((v) => v.id === vehicleId),
    needsAttentionCount: summary.needsAttentionCount,
  };
}

/** The first seeded dealership and one of its seeded aging vehicles without an action. */
async function seededTarget(app: FastifyInstance) {
  const dealerships = DealershipListResponseSchema.parse(await getJson(app, '/dealerships'));
  const dealershipId = dealerships.items[0]?.id;
  if (dealershipId === undefined) throw new Error('the seed has no dealership');
  const needsAttention = VehicleListResponseSchema.parse(
    await getJson(app, `/dealerships/${dealershipId}/vehicles?needsAttention=true`),
  );
  const vehicleId = needsAttention.items[0]?.id;
  if (vehicleId === undefined) throw new Error('the seed has no aging vehicle without an action');
  return { dealershipId, vehicleId };
}

const rowCounts = (db: Db) => ({
  dealerships: db.prepare<[], number>('SELECT COUNT(*) FROM dealerships').pluck().get(),
  vehicles: db.prepare<[], number>('SELECT COUNT(*) FROM vehicles').pluck().get(),
  actions: db.prepare<[], number>('SELECT COUNT(*) FROM vehicle_actions').pluck().get(),
});

const body = { status: 'Price Reduction Planned', note: 'Reduce by 5%', loggedBy: 'Jane Smith' };

describe('action history persistence on a file database (T-028)', () => {
  let dir: string;
  let path: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'api-persist-'));
    path = join(dir, 'inventory.db');
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('keeps a saved action on a seeded vehicle across a restart, without re-seeding (AC-007.3)', async () => {
    const first = await start(path);
    expect(first.applied.length).toBeGreaterThan(0);
    expect(first.seeded).toEqual(['inventory']);
    const { dealershipId, vehicleId } = await seededTarget(first.app);
    const before = await readBack(first.app, dealershipId, vehicleId);
    const posted = await first.app.inject({
      method: 'POST',
      url: `/api/vehicles/${vehicleId}/actions`,
      payload: body,
    });
    expect(posted.statusCode).toBe(201);
    const entry = ActionEntrySchema.parse(posted.json());
    const countsAfterPost = rowCounts(first.db);
    await first.stop();

    const second = await start(path);
    try {
      expect(second.applied).toEqual([]); // nothing re-applied, nothing reset
      expect(second.seeded).toEqual([]); // the seed did not run again over the saved data
      expect(rowCounts(second.db)).toEqual(countsAfterPost); // nothing duplicated or dropped

      const after = await readBack(second.app, dealershipId, vehicleId);
      expect(after.detail.actions).toEqual([entry, ...before.detail.actions]);
      expect(after.detail.currentAction).toEqual({
        status: 'Price Reduction Planned',
        loggedBy: 'Jane Smith',
        loggedAt: entry.loggedAt,
      });
      expect(after.listItem).toMatchObject({
        needsAttention: false,
        currentAction: { status: 'Price Reduction Planned', loggedBy: 'Jane Smith' },
      });
      expect(after.needsAttentionCount).toBe(before.needsAttentionCount - 1);
    } finally {
      await second.stop();
    }
  });

  it('shows an action written through one server to a second server on the same database (AC-007.2)', async () => {
    const writer = await start(path);
    const reader = await start(path);
    try {
      expect(reader.seeded).toEqual([]);
      const { dealershipId, vehicleId } = await seededTarget(reader.app);
      const before = await readBack(reader.app, dealershipId, vehicleId);
      expect(before.detail.currentAction).toBeNull();

      const posted = await writer.app.inject({
        method: 'POST',
        url: `/api/vehicles/${vehicleId}/actions`,
        payload: body,
      });
      expect(posted.statusCode).toBe(201);
      const entry = ActionEntrySchema.parse(posted.json());

      const after = await readBack(reader.app, dealershipId, vehicleId);
      expect(after.detail.actions[0]).toEqual(entry);
      expect(after.detail.currentAction).toEqual({
        status: entry.status,
        loggedBy: entry.loggedBy,
        loggedAt: entry.loggedAt,
      });
      expect(after.listItem).toMatchObject({
        needsAttention: false,
        currentAction: { status: 'Price Reduction Planned', loggedBy: 'Jane Smith' },
      });
      expect(after.needsAttentionCount).toBe(before.needsAttentionCount - 1);
    } finally {
      await writer.stop();
      await reader.stop();
    }
  });

  it('keeps the append-only triggers on the reopened database (BR-13)', async () => {
    const first = await start(path);
    const { vehicleId } = await seededTarget(first.app);
    const posted = await first.app.inject({
      method: 'POST',
      url: `/api/vehicles/${vehicleId}/actions`,
      payload: { status: 'Under Review', loggedBy: 'Jane Smith' },
    });
    expect(posted.statusCode).toBe(201);
    await first.stop();

    const second = await start(path);
    try {
      const { id } = ActionEntrySchema.parse(posted.json());
      expect(() =>
        second.db.prepare("UPDATE vehicle_actions SET note = 'edited' WHERE id = ?").run(id),
      ).toThrow(/append-only/);
      expect(() => second.db.prepare('DELETE FROM vehicle_actions WHERE id = ?').run(id)).toThrow(
        /append-only/,
      );
      expect(
        second.db.prepare('SELECT note FROM vehicle_actions WHERE id = ?').pluck().get(id),
      ).toBe(null);
    } finally {
      await second.stop();
    }
  });
});
