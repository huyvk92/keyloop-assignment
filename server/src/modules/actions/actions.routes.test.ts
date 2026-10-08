import { ActionEntrySchema, type ActionEntry } from '@shared/api/actions';
import { ApiErrorSchema } from '@shared/api/common';
import {
  InventorySummarySchema,
  VehicleDetailSchema,
  VehicleListResponseSchema,
} from '@shared/api/vehicles';
import { insertAction, insertDealership, insertVehicle } from '../../../test/factories';
import { createTestApp } from '../../../test/helpers';

type TestApp = Awaited<ReturnType<typeof createTestApp>>;
let ctx: TestApp;
let dealershipId: number;

beforeEach(async () => {
  ctx = await createTestApp({ today: '2026-10-07' });
  dealershipId = insertDealership(ctx.db, { name: 'Dealership A' });
});
afterEach(() => ctx.close());

const valid = {
  status: 'Price Reduction Planned',
  note: 'Reduce by 5%',
  loggedBy: 'Jane Smith',
};
const storedCount = () =>
  ctx.db.prepare<[], number>('SELECT COUNT(*) FROM vehicle_actions').pluck().get();

function post(vehicleId: number | string, payload: Record<string, unknown>) {
  return ctx.app.inject({ method: 'POST', url: `/api/vehicles/${vehicleId}/actions`, payload });
}
async function postOk(vehicleId: number, payload: Record<string, unknown>): Promise<ActionEntry> {
  const response = await post(vehicleId, payload);
  expect(response.statusCode).toBe(201);
  return ActionEntrySchema.parse(response.json());
}
async function getJson(url: string) {
  const response = await ctx.app.inject({ method: 'GET', url: `/api${url}` });
  expect(response.statusCode).toBe(200);
  const body: unknown = response.json();
  return body;
}
const detail = async (vehicleId: number) =>
  VehicleDetailSchema.parse(await getJson(`/vehicles/${vehicleId}`));

describe('POST /api/vehicles/:vehicleId/actions (T-027)', () => {
  describe('201 and read-back (AC-006.3, AC-007.1, AC-007.2)', () => {
    it('stores the entry with the server timestamp and returns it', async () => {
      const vehicleId = insertVehicle(ctx.db, { dealershipId, ageDays: 120 });

      const entry = await postOk(vehicleId, valid);

      expect(entry).toEqual({
        id: expect.any(Number),
        vehicleId,
        ...valid,
        loggedAt: '2026-10-07T12:00:00.000Z',
      });
      expect(storedCount()).toBe(1);
    });

    it('puts the entry on top of the history and makes it the current action', async () => {
      const vehicleId = insertVehicle(ctx.db, { dealershipId, ageDays: 120 });
      insertAction(ctx.db, {
        vehicleId,
        status: 'Under Review',
        loggedAt: '2026-10-07T09:00:00.000Z',
      });

      const entry = await postOk(vehicleId, valid);
      const body = await detail(vehicleId);

      expect(body.actions).toHaveLength(2);
      expect(body.actions[0]).toEqual(entry);
      expect(body.currentAction).toEqual({
        status: 'Price Reduction Planned',
        loggedBy: 'Jane Smith',
        loggedAt: entry.loggedAt,
      });
    });

    it('updates the list current action, needsAttention and the KPI count (AC-006.3, AC-010.2)', async () => {
      const vehicleId = insertVehicle(ctx.db, { dealershipId, ageDays: 120 });
      insertVehicle(ctx.db, { dealershipId, ageDays: 150 });
      const list = async (query = '') =>
        VehicleListResponseSchema.parse(
          await getJson(`/dealerships/${dealershipId}/vehicles${query}`),
        );
      const summary = async () =>
        InventorySummarySchema.parse(await getJson(`/dealerships/${dealershipId}/summary`));
      expect((await summary()).needsAttentionCount).toBe(2);

      await postOk(vehicleId, valid);

      const item = (await list()).items.find((v) => v.id === vehicleId);
      expect(item).toMatchObject({
        needsAttention: false,
        currentAction: { status: 'Price Reduction Planned', loggedBy: 'Jane Smith' },
      });
      expect((await summary()).needsAttentionCount).toBe(1);
      expect((await list('?needsAttention=true')).items.map((v) => v.id)).not.toContain(vehicleId);
    });

    it('orders same-instant entries by id under a pinned clock (TA-13)', async () => {
      const vehicleId = insertVehicle(ctx.db, { dealershipId, ageDays: 120 });

      const first = await postOk(vehicleId, { ...valid, status: 'Under Review' });
      const second = await postOk(vehicleId, { ...valid, status: 'Marketing Promotion' });
      const body = await detail(vehicleId);

      expect(first.loggedAt).toBe(second.loggedAt);
      expect(body.actions.map((a) => a.id)).toEqual([second.id, first.id]);
      expect(body.currentAction?.status).toBe('Marketing Promotion');
    });

    it('round-trips markup in the note verbatim as JSON data (AC-006.8)', async () => {
      const vehicleId = insertVehicle(ctx.db, { dealershipId, ageDays: 120 });

      const response = await post(vehicleId, { ...valid, note: '<b>cut</b>' });
      const read = await ctx.app.inject({ method: 'GET', url: `/api/vehicles/${vehicleId}` });

      expect(response.statusCode).toBe(201);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.body).toContain('"note":"<b>cut</b>"');
      expect(read.body).toContain('"note":"<b>cut</b>"');
      expect(VehicleDetailSchema.parse(read.json()).actions[0]?.note).toBe('<b>cut</b>');
    });

    it('trims the name and stores a blank note as null (BR-12, TA-17)', async () => {
      const vehicleId = insertVehicle(ctx.db, { dealershipId, ageDays: 120 });

      const entry = await postOk(vehicleId, { ...valid, note: '   ', loggedBy: '  Jane Smith ' });

      expect(entry).toMatchObject({ note: null, loggedBy: 'Jane Smith' });
      expect(
        ctx.db.prepare('SELECT note, logged_by AS loggedBy FROM vehicle_actions').get(),
      ).toEqual({ note: null, loggedBy: 'Jane Smith' });
    });

    it('ignores a client-supplied id, vehicleId and timestamp (BR-13)', async () => {
      const vehicleId = insertVehicle(ctx.db, { dealershipId, ageDays: 120 });
      const otherId = insertVehicle(ctx.db, { dealershipId, ageDays: 120 });

      const entry = await postOk(vehicleId, {
        ...valid,
        id: 999,
        vehicleId: otherId,
        loggedAt: '2020-01-01T00:00:00.000Z',
      });

      expect(entry).toMatchObject({ vehicleId, loggedAt: '2026-10-07T12:00:00.000Z' });
      expect(entry.id).not.toBe(999);
      expect((await detail(otherId)).actions).toEqual([]);
    });
  });

  describe('rejections store nothing (BR-18)', () => {
    let aging: number;
    beforeEach(() => {
      aging = insertVehicle(ctx.db, { dealershipId, ageDays: 120 });
      insertAction(ctx.db, { vehicleId: aging }); // a prior entry, so "unchanged" is not just 0
    });

    async function expectRejected(
      response: Awaited<ReturnType<typeof post>>,
      status: number,
      code: string,
    ) {
      expect(response.statusCode).toBe(status);
      expect(ApiErrorSchema.parse(response.json()).error.code).toBe(code);
      expect(storedCount()).toBe(1);
    }

    it.each([
      ['an empty status (AC-006.4)', { ...valid, status: '' }],
      ['a missing status (AC-006.4)', { note: valid.note, loggedBy: valid.loggedBy }],
      ['an unknown status (AC-006.6)', { ...valid, status: 'Sold' }],
      ['a differently cased status (AC-006.6)', { ...valid, status: 'price reduction planned' }],
      ['an empty loggedBy (AC-006.4)', { ...valid, loggedBy: '' }],
      ['a whitespace-only loggedBy (AC-006.4)', { ...valid, loggedBy: '   ' }],
      ['a 101-character loggedBy (BR-12)', { ...valid, loggedBy: 'j'.repeat(101) }],
      ['a 501-character note (AC-006.5)', { ...valid, note: 'n'.repeat(501) }],
      ['a null note', { ...valid, note: null }],
      ['a numeric status', { ...valid, status: 1 }],
    ])('400 VALIDATION_ERROR for %s', async (_label, payload) => {
      const response = await post(aging, payload);

      await expectRejected(response, 400, 'VALIDATION_ERROR');
      const details = ApiErrorSchema.parse(response.json()).error.details;
      expect(details).toBeDefined();
    });

    // Body-parse failures are invalid requests too: 400 VALIDATION_ERROR (TRD §4.2), including an
    // unsupported content type (see the comment in plugins/error-handler.ts).
    it.each([
      ['no body and no content type', {}],
      ['an empty JSON body', { headers: { 'content-type': 'application/json' }, payload: '' }],
      [
        'malformed JSON',
        { headers: { 'content-type': 'application/json' }, payload: '{"status":' },
      ],
      [
        'a JSON array instead of an object',
        { headers: { 'content-type': 'application/json' }, payload: '[]' },
      ],
      [
        'a text/plain body',
        { headers: { 'content-type': 'text/plain' }, payload: JSON.stringify(valid) },
      ],
      [
        'an unsupported content type',
        { headers: { 'content-type': 'application/xml' }, payload: '<action/>' },
      ],
    ] as const)('400 VALIDATION_ERROR with details for %s', async (_label, request) => {
      const response = await ctx.app.inject({
        method: 'POST',
        url: `/api/vehicles/${aging}/actions`,
        ...request,
      });

      await expectRejected(response, 400, 'VALIDATION_ERROR');
      expect(ApiErrorSchema.parse(response.json()).error.details).toBeDefined();
    });

    it.each(['abc', '0', '1e0', '-1'])('400 for the vehicle id %j', async (id) => {
      await expectRejected(await post(id, valid), 400, 'VALIDATION_ERROR');
    });

    it('404 NOT_FOUND for an unknown vehicle', async () => {
      const response = await post(999_999, valid);

      await expectRejected(response, 404, 'NOT_FOUND');
      expect(ApiErrorSchema.parse(response.json()).error.message).toBe('Vehicle 999999 not found');
    });

    it('422 VEHICLE_NOT_AGING for a 90-day vehicle, which keeps its history (AC-006.2)', async () => {
      const fresh = insertVehicle(ctx.db, { dealershipId, ageDays: 90 });

      const response = await post(fresh, valid);

      await expectRejected(response, 422, 'VEHICLE_NOT_AGING');
      expect(ApiErrorSchema.parse(response.json()).error).toEqual({
        code: 'VEHICLE_NOT_AGING',
        message: 'Actions can only be logged for vehicles in stock for more than 90 days',
        details: { daysInStock: 90 },
      });
    });

    it('validates before looking up the vehicle: 400 beats 404 and 422', async () => {
      const fresh = insertVehicle(ctx.db, { dealershipId, ageDays: 90 });
      const blankName = { ...valid, loggedBy: ' ' };

      await expectRejected(await post(999_999, blankName), 400, 'VALIDATION_ERROR');
      await expectRejected(await post(fresh, blankName), 400, 'VALIDATION_ERROR');
    });
  });

  describe('no edit or delete (BR-13, AC-007.6)', () => {
    it.each(['PUT', 'PATCH', 'DELETE'] as const)(
      '%s on the history or an entry is 404 and changes nothing',
      async (method) => {
        const vehicleId = insertVehicle(ctx.db, { dealershipId, ageDays: 120 });
        const entry = await postOk(vehicleId, valid);

        for (const url of [
          `/api/vehicles/${vehicleId}/actions`,
          `/api/vehicles/${vehicleId}/actions/${entry.id}`,
        ]) {
          const response = await ctx.app.inject({
            method,
            url,
            payload: { status: 'Under Review' },
          });
          expect(response.statusCode).toBe(404);
          expect(ApiErrorSchema.parse(response.json()).error.code).toBe('NOT_FOUND');
        }
        expect((await detail(vehicleId)).actions).toEqual([entry]);
      },
    );
  });
});
