import { caseRequest, CREATE_ACTION_CASES, type CreateActionCase } from '@shared/api/actions.cases';
import { ActionEntrySchema } from '@shared/api/actions';
import { ApiErrorSchema } from '@shared/api/common';
import { SCENARIO_TODAY } from '@shared/api/vehicles.cases';
import { insertAction, insertDealership, insertVehicle } from '../../../test/factories';
import { createTestApp } from '../../../test/helpers';

/**
 * API side of the create-action parity table; the mock side is src/mocks/action-store.test.ts.
 * The API is the source of truth.
 */
describe('create-action scenarios (API side of the MSW parity table)', () => {
  it.each(CREATE_ACTION_CASES.map((c) => [c.name, c] as const))(
    '%s',
    async (_name, scenario: CreateActionCase) => {
      const ctx = await createTestApp({ today: SCENARIO_TODAY });
      try {
        const dealershipId = insertDealership(ctx.db);
        const vehicleId = insertVehicle(ctx.db, {
          dealershipId,
          today: SCENARIO_TODAY,
          ageDays: scenario.vehicle.ageDays,
        });

        for (let i = 1; i <= (scenario.priorActions ?? 0); i += 1) {
          insertAction(ctx.db, { vehicleId, loggedAt: `2026-10-0${i}T09:00:00.000Z` });
        }
        const { contentType, payload } = caseRequest(scenario);

        const response = await ctx.app.inject({
          method: 'POST',
          url: `/api/vehicles/${scenario.pathId ?? vehicleId}/actions`,
          ...(contentType ? { headers: { 'content-type': contentType } } : {}),
          ...(payload === undefined ? {} : { payload }),
        });

        const { expected } = scenario;
        expect(response.statusCode).toBe(expected.status);
        if (expected.code) {
          const { error } = ApiErrorSchema.parse(response.json());
          expect(error.code).toBe(expected.code);
          if (expected.status === 400) expect(error.details).toBeDefined();
        }
        if (expected.entry) {
          expect(ActionEntrySchema.parse(response.json())).toMatchObject({
            vehicleId,
            ...expected.entry,
          });
        }
        expect(
          ctx.db.prepare<[], number>('SELECT COUNT(*) FROM vehicle_actions').pluck().get(),
        ).toBe(expected.storedCount);
      } finally {
        await ctx.close();
      }
    },
  );
});
