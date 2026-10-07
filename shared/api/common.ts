import { z } from 'zod';

/**
 * API contract shared by the web app (src/) and the API (server/).
 * Only Zod schemas and inferred types live here - no runtime code that depends on either side.
 */

/** Every non-2xx API response has this shape. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('up'),
  /** The server's notion of "today" (YYYY-MM-DD); fixed when APP_TODAY is set. */
  today: z.iso.date(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * A positive integer from a URL path or query string. Accepts a number or a digits-only string,
 * so forms that `Number()` would also accept ('0x1', '1e2', ' 2', '+2', '') are rejected
 * instead of being silently reinterpreted. Out of the safe-integer range is rejected by `.int()`.
 */
export function positiveIntParam({ max = Number.MAX_SAFE_INTEGER }: { max?: number } = {}) {
  // The number branch carries the bounds too, so the OpenAPI docs show minimum/maximum.
  return z
    .union([
      z.number().int().positive().max(max),
      z.string().regex(/^\d+$/, 'Expected a whole number'),
    ])
    .pipe(z.coerce.number<number | string>().int().positive().max(max));
}
