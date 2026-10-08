import { z } from 'zod';

/** Allowed action statuses, in display order (BR-10, TA-20). */
export const ACTION_STATUSES = [
  'Price Reduction Planned',
  'Marketing Promotion',
  'Transfer to Another Dealership',
  'Send to Auction/Wholesale',
  'Under Review',
] as const;

/** Maximum note length after trimming (BR-11). */
export const NOTE_MAX_LENGTH = 500;
/** Maximum "Logged by" length after trimming (BR-12). */
export const LOGGED_BY_MAX_LENGTH = 100;

export const ActionStatusSchema = z.enum(ACTION_STATUSES, { error: 'Select a status' });
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

/** Whitespace (`\s`) and Unicode format characters (`\p{Cf}`: U+200B..U+200D, U+2060, U+FEFF, U+00AD, bidi marks). */
const INVISIBLE_CHARS = /[\s\p{Cf}]/gu;

/**
 * True when the text has nothing visible: it is empty after removing every whitespace and Unicode
 * format (`\p{Cf}`) character. A name or note of only zero-width spaces is blank (BR-12, TA-17).
 * Used for the emptiness check only; a non-blank value is stored as the trimmed original.
 */
export function isBlankText(value: string): boolean {
  return value.replace(INVISIBLE_CHARS, '') === '';
}

/**
 * Body of POST /api/vehicles/:vehicleId/actions, also the web form schema (zodResolver).
 * Zod 4 runs `.trim()` before `.min`/`.max`, so the limits apply to the trimmed text (BR-11,
 * BR-12). A blank note (see `isBlankText`, e.g. only spaces or zero-width spaces) parses to '' and
 * is stored as NULL (TA-17); a blank name is rejected with "Enter your name" (BR-12). The
 * timestamp is never part of the request: the server assigns it (BR-13).
 */
export const CreateActionBodySchema = z.object({
  status: ActionStatusSchema,
  note: z
    .string()
    .trim()
    .overwrite((note) => (isBlankText(note) ? '' : note))
    .max(NOTE_MAX_LENGTH, 'Note must be 500 characters or fewer')
    .optional(),
  loggedBy: z
    .string()
    .trim()
    .min(1, 'Enter your name')
    // '' is already reported by `.min` (one message per field); this catches invisible-only names.
    .refine((name) => name === '' || !isBlankText(name), 'Enter your name')
    .max(LOGGED_BY_MAX_LENGTH, 'Name must be 100 characters or fewer'),
});
export type CreateActionBody = z.infer<typeof CreateActionBodySchema>;
/** What a client sends (before trimming). */
export type CreateActionBodyInput = z.input<typeof CreateActionBodySchema>;

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
