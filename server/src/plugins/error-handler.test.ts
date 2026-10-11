import { ApiErrorSchema } from '@shared/api/common';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createTestApp } from '../../test/helpers';
import { BusinessRuleError, NotFoundError } from '../lib/errors';

function registerTestRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post(
    '/api/test/validate',
    { schema: { body: z.object({ note: z.string().max(5) }) } },
    async () => ({ ok: true }),
  );
  typed.get('/api/test/not-found', async () => {
    throw new NotFoundError('Vehicle not found');
  });
  typed.get('/api/test/rule', async () => {
    throw new BusinessRuleError(
      'VEHICLE_NOT_AGING',
      'Actions can only be logged for aging vehicles',
    );
  });
  typed.get('/api/test/teapot', async () => {
    throw Object.assign(new Error('I am a teapot'), { statusCode: 418, code: 'FST_ERR_TEAPOT' });
  });
  typed.get('/api/test/crash', async () => {
    throw new Error('secret internal detail');
  });
  typed.get(
    '/api/test/bad-response',
    { schema: { response: { 200: z.object({ id: z.string() }) } } },
    async () => ({ id: 42 }) as unknown as { id: string },
  );
}

describe('error handler', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeEach(async () => {
    ctx = await createTestApp({ setup: registerTestRoutes });
  });
  afterEach(async () => {
    await ctx.close();
  });

  it('returns 400 VALIDATION_ERROR with details for invalid input', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/test/validate',
      payload: { note: 'too long' },
    });

    expect(response.statusCode).toBe(400);
    const body = ApiErrorSchema.parse(response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('maps AppError subclasses to their status and code', async () => {
    const notFound = await ctx.app.inject({ method: 'GET', url: '/api/test/not-found' });
    expect(notFound.statusCode).toBe(404);
    expect(notFound.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });

    const rule = await ctx.app.inject({ method: 'GET', url: '/api/test/rule' });
    expect(rule.statusCode).toBe(422);
    expect(ApiErrorSchema.parse(rule.json()).error.code).toBe('VEHICLE_NOT_AGING');
  });

  it('hides internal details of unexpected errors', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/test/crash' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  it('returns 500 when a response does not match its schema', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/test/bad-response' });

    expect(response.statusCode).toBe(500);
    expect(ApiErrorSchema.parse(response.json()).error.code).toBe('INTERNAL_ERROR');
  });

  it('returns 404 NOT_FOUND for unknown routes', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/nope' });

    expect(response.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(response.json()).error.code).toBe('NOT_FOUND');
  });

  it.each([
    ['malformed JSON', 'application/json', '{not json'],
    ['an empty JSON body', 'application/json', ''],
    ['an unsupported content type', 'application/xml', '<note/>'],
  ])('maps a body-parse failure (%s) to 400 VALIDATION_ERROR', async (_label, type, payload) => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/test/validate',
      headers: { 'content-type': type },
      payload,
    });

    expect(response.statusCode).toBe(400);
    const body = ApiErrorSchema.parse(response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual([{ message: expect.any(String) }]);
  });

  it('passes other 4xx framework errors through with their own status and code', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/test/teapot' });

    expect(response.statusCode).toBe(418);
    expect(response.json()).toEqual({
      error: { code: 'FST_ERR_TEAPOT', message: 'I am a teapot' },
    });
  });
});
