import { z } from 'zod';
import { CurrentActionSchema } from './actions';
import { positiveIntParam } from './common';

/** A vehicle is aging when its age is strictly greater than this (BR-02; fixed, US-014). */
export const AGING_THRESHOLD_DAYS = 90;
export const SORT_KEYS = ['age', 'price', 'makeModel'] as const; // US-011
export type SortKey = (typeof SORT_KEYS)[number];
export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];
export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 100;

/**
 * Filter fields shared by the paged list and (later) the CSV export. Kept as a plain object so
 * it can be extended. When `order` is omitted the server uses the per-key default (TA-06).
 */
export const VehicleFilterBaseSchema = z.object({
  sort: z.enum(SORT_KEYS).default('age'),
  order: z.enum(SORT_ORDERS).optional(),
});

/** Query string of GET /api/dealerships/:dealershipId/vehicles (also the dashboard URL state). */
export const VehicleListQuerySchema = VehicleFilterBaseSchema.extend({
  page: positiveIntParam().default(1),
  pageSize: positiveIntParam({ max: PAGE_SIZE_MAX }).default(PAGE_SIZE_DEFAULT),
});
export type VehicleListQuery = z.infer<typeof VehicleListQuerySchema>;
/** Raw (pre-default, pre-coercion) query, e.g. what the web puts in the URL. */
export type VehicleListQueryInput = z.input<typeof VehicleListQuerySchema>;

export const VehicleListItemSchema = z.object({
  id: z.number().int().positive(),
  dealershipId: z.number().int().positive(),
  vin: z.string().length(17),
  stockNumber: z.string(),
  make: z.string(),
  model: z.string(),
  modelYear: z.number().int(),
  trim: z.string(),
  colour: z.string(),
  /** Miles (TA-04). */
  mileage: z.number().int().nonnegative(),
  /** Integer minor units (pence) in the dealership currency (ADR-005). */
  listPriceMinor: z.number().int().nonnegative(),
  stockInDate: z.iso.date(),
  /** Server-derived, in the dealership time zone (BR-01). */
  daysInStock: z.number().int().nonnegative(),
  /** daysInStock > AGING_THRESHOLD_DAYS (BR-02/BR-03). */
  isAging: z.boolean(),
  /** Aging and no current action (BR-16). */
  needsAttention: z.boolean(),
  /** Latest history entry; null = "No action" (BR-14). */
  currentAction: CurrentActionSchema.nullable(),
});
export type VehicleListItem = z.infer<typeof VehicleListItemSchema>;

export const VehicleListResponseSchema = z.object({
  items: z.array(VehicleListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type VehicleListResponse = z.infer<typeof VehicleListResponseSchema>;

export const VehicleParamsSchema = z.object({ vehicleId: positiveIntParam() });
export type VehicleParams = z.infer<typeof VehicleParamsSchema>;
