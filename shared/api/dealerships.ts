import { z } from 'zod';
import { intParam } from './common';

export const DealershipSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  /** ISO 4217 code, e.g. 'GBP'. */
  currency: z.string().length(3),
  /** IANA time zone, e.g. 'Europe/London'; "today" for vehicle age is taken in this zone. */
  timeZone: z.string(),
});
export type Dealership = z.infer<typeof DealershipSchema>;

/** GET /api/dealerships - sorted by name A-Z. */
export const DealershipListResponseSchema = z.object({ items: z.array(DealershipSchema) });
export type DealershipListResponse = z.infer<typeof DealershipListResponseSchema>;

export const DealershipParamsSchema = z.object({
  dealershipId: intParam({ min: 1 }),
});
export type DealershipParams = z.infer<typeof DealershipParamsSchema>;
