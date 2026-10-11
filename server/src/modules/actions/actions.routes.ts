import { ActionEntrySchema, CreateActionBodySchema } from '@shared/api/actions';
import { ApiErrorSchema } from '@shared/api/common';
import { VehicleParamsSchema } from '@shared/api/vehicles';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Db } from '../../db/connection';
import type { Clock } from '../../lib/clock';
import { createDealershipsRepository } from '../dealerships/dealerships.repository';
import { createInventoryRepository } from '../inventory/inventory.repository';
import { createInventoryService } from '../inventory/inventory.service';
import { createActionsRepository } from './actions.repository';
import { createActionsService } from './actions.service';

type Options = { db: Db; clock: Clock };

/**
 * POST only: the history is append-only, so there is no PUT, PATCH or DELETE (BR-13, AC-007.6).
 * Reads go through GET /api/vehicles/:vehicleId (inventory routes).
 */
export const actionRoutes: FastifyPluginAsyncZod<Options> = async (app, { db, clock }) => {
  const actions = createActionsRepository(db);
  const service = createActionsService({
    vehicles: createInventoryService({
      dealerships: createDealershipsRepository(db),
      inventory: createInventoryRepository(db),
      actions,
      clock,
    }),
    actions,
    clock,
  });

  app.post(
    '/vehicles/:vehicleId/actions',
    {
      schema: {
        tags: ['actions'],
        summary:
          'Log an action for an aging vehicle (append-only; the server assigns the timestamp)',
        params: VehicleParamsSchema,
        body: CreateActionBodySchema,
        response: {
          201: ActionEntrySchema,
          400: ApiErrorSchema,
          404: ApiErrorSchema,
          422: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const entry = service.logAction(request.params.vehicleId, request.body);
      return reply.code(201).send(entry);
    },
  );
};
