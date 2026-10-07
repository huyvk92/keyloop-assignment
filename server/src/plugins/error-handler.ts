import type { ApiError } from '@shared/api/common';
import type { FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { AppError } from '../lib/errors';

function errorBody(code: string, message: string, details?: unknown): ApiError {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } };
}

function getNumber(value: unknown, key: string): number | undefined {
  const field = typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
  return typeof field === 'number' ? field : undefined;
}

function getString(value: unknown, key: string): string | undefined {
  const field = typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
  return typeof field === 'string' ? field : undefined;
}

/** Uniform error responses: every non-2xx body matches ApiErrorSchema. */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply
        .code(400)
        .send(errorBody('VALIDATION_ERROR', 'Request validation failed', error.validation));
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(errorBody(error.code, error.message, error.details));
    }
    if (isResponseSerializationError(error)) {
      request.log.error({ err: error }, 'Response did not match its schema');
      return reply.code(500).send(errorBody('INTERNAL_ERROR', 'An unexpected error occurred'));
    }

    const statusCode = getNumber(error, 'statusCode') ?? 500;
    if (statusCode < 500 && error instanceof Error) {
      const code = getString(error, 'code') ?? 'BAD_REQUEST';
      return reply.code(statusCode).send(errorBody(code, error.message));
    }
    request.log.error({ err: error }, 'Unhandled error');
    return reply.code(500).send(errorBody('INTERNAL_ERROR', 'An unexpected error occurred'));
  });

  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .send(errorBody('NOT_FOUND', `Route ${request.method} ${request.url} not found`)),
  );
}
