import { HealthResponseSchema } from '@shared/api/common';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Db } from '../db/connection';
import type { Clock } from '../lib/clock';

type Options = { db: Db; clock: Clock };

export const healthRoutes: FastifyPluginAsyncZod<Options> = async (app, { db, clock }) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness and database check',
        response: { 200: HealthResponseSchema },
      },
    },
    async () => {
      db.prepare('SELECT 1').get();
      return {
        status: 'ok' as const,
        database: 'up' as const,
        today: clock.now().toISOString().slice(0, 10),
      };
    },
  );
};
