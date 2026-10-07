import { ApiErrorSchema } from '@shared/api/common';
import { DealershipParamsSchema } from '@shared/api/dealerships';
import {
  FacetsResponseSchema,
  VehicleListQuerySchema,
  VehicleListResponseSchema,
} from '@shared/api/vehicles';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Db } from '../../db/connection';
import type { Clock } from '../../lib/clock';
import { createDealershipsRepository } from '../dealerships/dealerships.repository';
import { createInventoryRepository } from './inventory.repository';
import { createInventoryService } from './inventory.service';

type Options = { db: Db; clock: Clock };

export const inventoryRoutes: FastifyPluginAsyncZod<Options> = async (app, { db, clock }) => {
  const service = createInventoryService({
    dealerships: createDealershipsRepository(db),
    inventory: createInventoryRepository(db),
    clock,
  });

  app.get(
    '/dealerships/:dealershipId/vehicles',
    {
      schema: {
        tags: ['inventory'],
        summary:
          'Paged vehicle list (filtered, searched and sorted) with derived age, aging flag and current action',
        params: DealershipParamsSchema,
        querystring: VehicleListQuerySchema,
        response: { 200: VehicleListResponseSchema, 400: ApiErrorSchema, 404: ApiErrorSchema },
      },
    },
    async (request) => service.listVehicles(request.params.dealershipId, request.query),
  );

  app.get(
    '/dealerships/:dealershipId/facets',
    {
      schema: {
        tags: ['inventory'],
        summary: "Make/model filter options from the dealership's stock (A-Z)",
        params: DealershipParamsSchema,
        response: { 200: FacetsResponseSchema, 400: ApiErrorSchema, 404: ApiErrorSchema },
      },
    },
    async (request) => service.getFacets(request.params.dealershipId),
  );
};
