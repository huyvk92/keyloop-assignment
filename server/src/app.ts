import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Config } from './config';
import type { Db } from './db/connection';
import type { Clock } from './lib/clock';
import { dealershipRoutes } from './modules/dealerships/dealerships.routes';
import { inventoryRoutes } from './modules/inventory/inventory.routes';
import { registerErrorHandler } from './plugins/error-handler';
import { healthRoutes } from './routes/health';

export type AppDeps = {
  db: Db;
  clock: Clock;
  config: Pick<Config, 'CORS_ORIGIN'>;
};

/**
 * Build the Fastify app with all dependencies injected (no globals), so tests can pass an
 * in-memory database and a fixed clock. Feature modules are registered under /api.
 */
export async function buildApp(deps: AppDeps, options: FastifyServerOptions = {}) {
  const app = Fastify(options).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(helmet);
  await app.register(cors, { origin: deps.config.CORS_ORIGIN });
  await app.register(swagger, {
    openapi: { info: { title: 'Inventory API', version: '1.0.0' } },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs', staticCSP: true });

  await app.register(healthRoutes, { prefix: '/api', db: deps.db, clock: deps.clock });
  await app.register(dealershipRoutes, { prefix: '/api', db: deps.db });
  await app.register(inventoryRoutes, { prefix: '/api', db: deps.db, clock: deps.clock });

  return app;
}
