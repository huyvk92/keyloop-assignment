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
