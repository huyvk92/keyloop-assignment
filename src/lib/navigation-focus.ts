import { z } from 'zod';

/**
 * Router location state for a navigation triggered by an in-page control (e.g. the dealership
 * selector). The page keeps focus on that control instead of moving it to the `<h1>`, so a
 * keyboard or screen-reader user changing a select does not lose their place (T-033).
 * Browser Back/Forward and links carry no such state and still focus the heading (skill §8).
 */
export const KEEP_FOCUS_STATE = { keepFocus: true } as const;

const KeepFocusStateSchema = z.object({ keepFocus: z.literal(true) });

/** History state is external data (it survives reloads), so it is validated, not trusted. */
export function shouldKeepFocus(state: unknown): boolean {
  return KeepFocusStateSchema.safeParse(state).success;
}
