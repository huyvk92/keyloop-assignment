import { z } from 'zod';

/** Allowed action statuses, in display order (BR-10, TA-20). */
export const ACTION_STATUSES = [
  'Price Reduction Planned',
  'Marketing Promotion',
  'Transfer to Another Dealership',
  'Send to Auction/Wholesale',
  'Under Review',
] as const;

export const ActionStatusSchema = z.enum(ACTION_STATUSES, { error: 'Select a status' });
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

/** One append-only history entry (BR-13). `loggedAt` is assigned by the server, in UTC. */
export const ActionEntrySchema = z.object({
  id: z.number().int().positive(),
  vehicleId: z.number().int().positive(),
  status: ActionStatusSchema,
  note: z.string().nullable(),
  loggedBy: z.string(),
  loggedAt: z.iso.datetime(),
});
export type ActionEntry = z.infer<typeof ActionEntrySchema>;

/** The latest history entry of a vehicle (BR-14); `null` on a vehicle means "No action". */
export const CurrentActionSchema = ActionEntrySchema.pick({
  status: true,
  loggedBy: true,
  loggedAt: true,
});
export type CurrentAction = z.infer<typeof CurrentActionSchema>;
