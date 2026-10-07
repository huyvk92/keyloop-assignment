import { DealershipListResponseSchema } from '@shared/api/dealerships';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Db } from '../../db/connection';
import { createDealershipsRepository } from './dealerships.repository';

type Options = { db: Db };

export const dealershipRoutes: FastifyPluginAsyncZod<Options> = async (app, { db }) => {
  const repository = createDealershipsRepository(db);

  app.get(
    '/dealerships',
    {
      schema: {
        tags: ['dealerships'],
        summary: 'List dealerships, sorted by name',
        response: { 200: DealershipListResponseSchema },
      },
    },
    async () => ({ items: repository.findAll() }),
  );
};
