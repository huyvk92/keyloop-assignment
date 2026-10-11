import { z } from 'zod';
import { ActionEntrySchema, CurrentActionSchema } from './actions';
import { intParam } from './common';

/** A vehicle is aging when its age is strictly greater than this (BR-02; fixed, US-014). */
export const AGING_THRESHOLD_DAYS = 90;
export const SORT_KEYS = ['age', 'price', 'makeModel'] as const; // US-011
export type SortKey = (typeof SORT_KEYS)[number];
export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];
export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 100;

/** Inclusive age buckets in days (BR-07, TA-07): 0-30, 31-60, 61-90 and 91+. */
export const AGE_BUCKETS = ['0-30', '31-60', '61-90', 'over-90'] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];
/** Upper bound for a custom age (100 years); keeps date arithmetic in range. */
export const MAX_AGE_DAYS = 36_500;
export const SEARCH_MAX_LENGTH = 100; // BR-08, TA-08
export const MAKE_MODEL_MAX_LENGTH = 50;
export const AGE_RANGE_ERROR_MESSAGE = 'Minimum age must be less than or equal to maximum age';

const ageParam = intParam({ min: 0, max: MAX_AGE_DAYS });
const ageRangeValid = (range: { minAge?: number | undefined; maxAge?: number | undefined }) =>
  range.minAge === undefined || range.maxAge === undefined || range.minAge <= range.maxAge;
const ageRangeIssue = { message: AGE_RANGE_ERROR_MESSAGE, path: ['maxAge'] };

/**
 * Filter fields shared by the paged list and (later) the CSV export. Kept as a plain, unrefined
 * object so it can be extended (Zod 4 forbids .extend on refined objects); the min <= max refine
 * is applied last on each final schema. All filters combine with AND (BR-05). Make and model are
 * single values (TA-02). When `order` is omitted the server uses the per-key default (TA-06).
 */
export const VehicleFilterBaseSchema = z.object({
  make: z.string().trim().min(1).max(MAKE_MODEL_MAX_LENGTH).optional(),
  model: z.string().trim().min(1).max(MAKE_MODEL_MAX_LENGTH).optional(),
  ageBucket: z.enum(AGE_BUCKETS).optional(),
  minAge: ageParam.optional(),
  maxAge: ageParam.optional(),
  /** 'true'/'false' (also 1/0, yes/no); z.coerce.boolean would turn 'false' into true. */
  agingOnly: z.stringbool().optional(),
  /** Aging and no current action (BR-16). */
  needsAttention: z.stringbool().optional(),
  /** Partial, case-insensitive match on VIN, stock number or model, trimmed (BR-08). */
  q: z.string().trim().min(1).max(SEARCH_MAX_LENGTH).optional(),
  sort: z.enum(SORT_KEYS).default('age'),
  order: z.enum(SORT_ORDERS).optional(),
});
export type VehicleFilter = z.infer<typeof VehicleFilterBaseSchema>;

/** Query string of GET /api/dealerships/:dealershipId/vehicles (also the dashboard URL state). */
export const VehicleListQuerySchema = VehicleFilterBaseSchema.extend({
  page: intParam({ min: 1 }).default(1),
  pageSize: intParam({ min: 1, max: PAGE_SIZE_MAX }).default(PAGE_SIZE_DEFAULT),
}).refine(ageRangeValid, ageRangeIssue); // BR-07, AC-002.4
export type VehicleListQuery = z.infer<typeof VehicleListQuerySchema>;
/** Raw (pre-default, pre-coercion) query, e.g. what the web puts in the URL. */
export type VehicleListQueryInput = z.input<typeof VehicleListQuerySchema>;

/** Empty form input means "no bound" (not 0). */
const ageFormField = z.union([z.literal('').transform(() => undefined), ageParam]).optional();

/** The web's inline custom-range form: same bounds and min <= max rule as the query (BR-07). */
export const AgeRangeFormSchema = z
  .object({ minAge: ageFormField, maxAge: ageFormField })
  .refine(ageRangeValid, ageRangeIssue);
export type AgeRangeForm = z.infer<typeof AgeRangeFormSchema>;
export type AgeRangeFormInput = z.input<typeof AgeRangeFormSchema>;

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

export const VehicleParamsSchema = z.object({ vehicleId: intParam({ min: 1 }) });
export type VehicleParams = z.infer<typeof VehicleParamsSchema>;

/**
 * GET /api/vehicles/:vehicleId - the list item (same derived fields), the dealership's currency
 * and time zone for display, and the full action history newest first (`loggedAt` desc, then id
 * desc; BR-13). `actions[0]` is the current action (BR-14); `[]` means "No action".
 */
export const VehicleDetailSchema = VehicleListItemSchema.extend({
  currency: z.string().length(3),
  timeZone: z.string(),
  actions: z.array(ActionEntrySchema),
});
export type VehicleDetail = z.infer<typeof VehicleDetailSchema>;

/** GET /api/dealerships/:dealershipId/facets - distinct makes A-Z, each with its models A-Z (BR-06). */
export const FacetsResponseSchema = z.object({
  makes: z.array(z.object({ make: z.string(), models: z.array(z.string()) })),
});
export type FacetsResponse = z.infer<typeof FacetsResponseSchema>;
export type MakeFacet = FacetsResponse['makes'][number];

/**
 * GET /api/dealerships/:dealershipId/summary - KPIs over the dealership's whole in-stock
 * inventory; list filters never apply (BR-15, AC-005.2). Rounding per TA-21: `agingPercent` to
 * 1 dp, `averageDaysInStock` to a whole day (half up). Empty stock gives 0 / 0 / 0 / null.
 */
export const InventorySummarySchema = z.object({
  /** The dealership-local "today" the ages were computed for (TA-01). */
  asOfDate: z.iso.date(),
  totalVehicles: z.number().int().nonnegative(),
  /** Vehicles older than AGING_THRESHOLD_DAYS (BR-02). */
  agingCount: z.number().int().nonnegative(),
  /** 0-100, one decimal place; 0 when there are no vehicles. */
  agingPercent: z.number().min(0).max(100),
  /** Mean of the (never negative) ages; null when there are no vehicles (shown as "-"). */
  averageDaysInStock: z.number().int().nonnegative().nullable(),
  /** Aging and no current action (BR-16); equals the `needsAttention=true` list total. */
  needsAttentionCount: z.number().int().nonnegative(),
});
export type InventorySummary = z.infer<typeof InventorySummarySchema>;
