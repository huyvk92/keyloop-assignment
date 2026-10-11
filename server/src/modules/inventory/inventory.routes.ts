import { ApiErrorSchema } from '@shared/api/common';
import { DealershipParamsSchema } from '@shared/api/dealerships';
import {
  FacetsResponseSchema,
  InventorySummarySchema,
  VehicleDetailSchema,
  VehicleListQuerySchema,
  VehicleListResponseSchema,
  VehicleParamsSchema,
} from '@shared/api/vehicles';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Db } from '../../db/connection';
import type { Clock } from '../../lib/clock';
import { createActionsRepository } from '../actions/actions.repository';
import { createDealershipsRepository } from '../dealerships/dealerships.repository';
import { createInventoryRepository } from './inventory.repository';
import { createInventoryService } from './inventory.service';

type Options = { db: Db; clock: Clock };

export const inventoryRoutes: FastifyPluginAsyncZod<Options> = async (app, { db, clock }) => {
  const service = createInventoryService({
    dealerships: createDealershipsRepository(db),
    inventory: createInventoryRepository(db),
    actions: createActionsRepository(db),
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
  // No querystring schema: list filters never apply to the KPIs, so any query is ignored (BR-15).
  app.get(
    '/dealerships/:dealershipId/summary',
    {
      schema: {
        tags: ['inventory'],
        summary:
          "KPIs over the dealership's whole stock (list filters ignored): total, aging, % aging, average days in stock, needs attention",
        params: DealershipParamsSchema,
        response: { 200: InventorySummarySchema, 400: ApiErrorSchema, 404: ApiErrorSchema },
      },
    },
    async (request) => service.getSummary(request.params.dealershipId),
  );

  app.get(
    '/vehicles/:vehicleId',
    {
      schema: {
        tags: ['inventory'],
        summary:
          'One vehicle with the list fields, the dealership currency and time zone, and its action history newest first',
        params: VehicleParamsSchema,
        response: { 200: VehicleDetailSchema, 400: ApiErrorSchema, 404: ApiErrorSchema },
      },
    },
    async (request) => service.getVehicleDetail(request.params.vehicleId),
  );
};
