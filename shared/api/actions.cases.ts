/**
 * Shared create-action scenarios (POST /api/vehicles/:vehicleId/actions) run against BOTH the real
 * API (server/src/modules/actions/actions.parity.test.ts, `app.inject`, SQLite) and the MSW mock
 * (src/mocks/action-store.test.ts, `fetch` through the real MSW handler), so body parsing,
 * validation, precedence and storage cannot drift apart. The server is the source of truth: when a
 * row fails only on the web side, fix the mock.
 *
 * Data plus one pure helper (`caseRequest`); imports types only. Each scenario has exactly one
 * vehicle (aged `vehicle.ageDays` relative to SCENARIO_TODAY) with `priorActions` history entries
 * (default 0) logged before the request, so `storedCount` is the number of history rows after the
 * request: `priorActions + 1` when accepted, `priorActions` (unchanged) for every rejection (BR-18).
 *
 * Precedence (TRD §4.2): 400 (params, then body) before 404 (unknown vehicle) before 422
 * (VEHICLE_NOT_AGING). `pathId` replaces the vehicle's id in the URL; '999999' never exists.
 */
import type { ActionEntry } from './actions';

/** A request body sent verbatim: malformed JSON, or no body at all (`payload` omitted). */
export type RawBody = { contentType?: string; payload?: string };

export type CreateActionCase = {
  name: string;
  vehicle: { ageDays: number };
  /** History entries the vehicle has before the request (default 0). */
  priorActions?: number;
  /** Raw path segment instead of the created vehicle's id (unknown or non-canonical ids). */
  pathId?: string;
  expected: {
    status: 201 | 400 | 404 | 422;
    /** `error.code` of a rejection. */
    code?: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'VEHICLE_NOT_AGING';
    /** Stored fields of an accepted entry (after trimming; a blank note is null, TA-17). */
    entry?: Pick<ActionEntry, 'status' | 'note' | 'loggedBy'>;
    /** History rows after the request (prior entries included). */
    storedCount: number;
  };
} & (
  | {
      /** Sent as JSON (`application/json`). */
      body: Record<string, unknown>;
      rawBody?: never;
    }
  | { body?: never; rawBody: RawBody }
);

/** Content type and payload to send for a scenario (both runners use this). */
export function caseRequest(scenario: CreateActionCase): RawBody {
  if (scenario.rawBody) return scenario.rawBody;
  return { contentType: 'application/json', payload: JSON.stringify(scenario.body) };
}

/** An id no scenario vehicle has. */
export const UNKNOWN_VEHICLE_ID = '999999';

const AGING = { ageDays: 91 };
const valid = {
  status: 'Price Reduction Planned',
  note: 'Reduce by 5%',
  loggedBy: 'Jane Smith',
} as const;
const accepted = (entry: NonNullable<CreateActionCase['expected']['entry']>) =>
  ({ status: 201, entry, storedCount: 1 }) as const;
const invalid = { status: 400, code: 'VALIDATION_ERROR', storedCount: 0 } as const;
const note500 = 'n'.repeat(500);
const name100 = 'j'.repeat(100);
const ZWSP = '\u200B';

export const CREATE_ACTION_CASES: CreateActionCase[] = [
  // BR-09: strictly more than 90 days (AC-006.2)
  {
    name: 'AC-006.3: a 91-day vehicle accepts the action',
    vehicle: AGING,
    body: valid,
    expected: accepted(valid),
  },
  {
    name: 'BR-09: a 90-day vehicle is rejected with VEHICLE_NOT_AGING',
    vehicle: { ageDays: 90 },
    body: valid,
    expected: { status: 422, code: 'VEHICLE_NOT_AGING', storedCount: 0 },
  },
  {
    name: 'BR-09: a new (0-day) vehicle is rejected with VEHICLE_NOT_AGING',
    vehicle: { ageDays: 0 },
    body: valid,
    expected: { status: 422, code: 'VEHICLE_NOT_AGING', storedCount: 0 },
  },
  // BR-10: status (AC-006.4, AC-006.6)
  {
    name: 'BR-10: a missing status is rejected',
    vehicle: AGING,
    body: { note: valid.note, loggedBy: valid.loggedBy },
    expected: invalid,
  },
  {
    name: 'BR-10: an empty status is rejected',
    vehicle: AGING,
    body: { ...valid, status: '' },
    expected: invalid,
  },
  {
    name: 'BR-10: an unknown status is rejected',
    vehicle: AGING,
    body: { ...valid, status: 'Sold' },
    expected: invalid,
  },
  {
    name: 'BR-10: a differently cased status is rejected',
    vehicle: AGING,
    body: { ...valid, status: 'under review' },
    expected: invalid,
  },
  ...(
    [
      'Marketing Promotion',
      'Transfer to Another Dealership',
      'Send to Auction/Wholesale',
      'Under Review',
    ] as const
  ).map((status) => ({
    name: `BR-10: the status "${status}" is accepted`,
    vehicle: AGING,
    body: { ...valid, status },
    expected: accepted({ ...valid, status }),
  })),
  {
    name: 'BR-10: a numeric status is rejected (type error)',
    vehicle: AGING,
    body: { ...valid, status: 1 },
    expected: invalid,
  },
  // BR-12: loggedBy (AC-006.4)
  {
    name: 'BR-12: an empty loggedBy is rejected',
    vehicle: AGING,
    body: { ...valid, loggedBy: '' },
    expected: invalid,
  },
  {
    name: 'BR-12: a whitespace-only loggedBy is rejected',
    vehicle: AGING,
    body: { ...valid, loggedBy: '   ' },
    expected: invalid,
  },
  {
    name: 'BR-12: a missing loggedBy is rejected',
    vehicle: AGING,
    body: { status: valid.status },
    expected: invalid,
  },
  {
    name: 'BR-12: a 100-character loggedBy is accepted',
    vehicle: AGING,
    body: { ...valid, loggedBy: name100 },
    expected: accepted({ ...valid, loggedBy: name100 }),
  },
  {
    name: 'BR-12: a 101-character loggedBy is rejected',
    vehicle: AGING,
    body: { ...valid, loggedBy: `${name100}j` },
    expected: invalid,
  },
  {
    name: 'BR-12: a 100-character loggedBy with surrounding spaces is accepted, stored trimmed',
    vehicle: AGING,
    body: { ...valid, loggedBy: `  ${name100}   ` },
    expected: accepted({ ...valid, loggedBy: name100 }),
  },
  {
    name: 'BR-12: a zero-width-space-only loggedBy is rejected as blank',
    vehicle: AGING,
    body: { ...valid, loggedBy: ZWSP },
    expected: invalid,
  },
  {
    name: 'BR-12: a loggedBy of only spaces and format characters is rejected as blank',
    vehicle: AGING,
    body: { ...valid, loggedBy: ` ${ZWSP}\u2060\u00AD ` },
    expected: invalid,
  },
  {
    name: 'BR-12: a name with a zero-width character inside visible text is stored as given',
    vehicle: AGING,
    body: { ...valid, loggedBy: ` ${ZWSP}Jane Smith ` },
    expected: accepted({ ...valid, loggedBy: `${ZWSP}Jane Smith` }),
  },
  {
    name: 'BR-12: loggedBy is stored trimmed',
    vehicle: AGING,
    body: { ...valid, loggedBy: '  Jane Smith  ' },
    expected: accepted(valid),
  },
  // BR-11: note (AC-006.5), TA-17
  {
    name: 'BR-11: a 500-character note is accepted',
    vehicle: AGING,
    body: { ...valid, note: note500 },
    expected: accepted({ ...valid, note: note500 }),
  },
  {
    name: 'BR-11: a 501-character note is rejected',
    vehicle: AGING,
    body: { ...valid, note: `${note500}n` },
    expected: invalid,
  },
  {
    name: 'BR-11: 500 characters plus surrounding spaces is accepted and stored trimmed',
    vehicle: AGING,
    body: { ...valid, note: `   ${note500}  ` },
    expected: accepted({ ...valid, note: note500 }),
  },
  {
    name: 'TA-17: a whitespace-only note is stored as null',
    vehicle: AGING,
    body: { ...valid, note: '   ' },
    expected: accepted({ ...valid, note: null }),
  },
  {
    name: 'TA-17: an empty note is stored as null',
    vehicle: AGING,
    body: { ...valid, note: '' },
    expected: accepted({ ...valid, note: null }),
  },
  {
    name: 'TA-17: a zero-width-space-only note is stored as null',
    vehicle: AGING,
    body: { ...valid, note: ` ${ZWSP}${ZWSP} ` },
    expected: accepted({ ...valid, note: null }),
  },
  {
    name: 'BR-11: a null note is rejected (type error; omit the field instead)',
    vehicle: AGING,
    body: { ...valid, note: null },
    expected: invalid,
  },
  {
    name: 'BR-11: an omitted note is stored as null',
    vehicle: AGING,
    body: { status: valid.status, loggedBy: valid.loggedBy },
    expected: accepted({ ...valid, note: null }),
  },
  {
    name: 'AC-006.8: markup in the note is stored verbatim',
    vehicle: AGING,
    body: { ...valid, note: '<b>cut</b>' },
    expected: accepted({ ...valid, note: '<b>cut</b>' }),
  },
  // Body parsing (TRD §4.2: any invalid request is 400 VALIDATION_ERROR)
  {
    name: '400: no body at all',
    vehicle: AGING,
    rawBody: {},
    expected: invalid,
  },
  {
    name: '400: an empty JSON body',
    vehicle: AGING,
    rawBody: { contentType: 'application/json', payload: '' },
    expected: invalid,
  },
  {
    name: '400: malformed JSON',
    vehicle: AGING,
    rawBody: { contentType: 'application/json', payload: '{"status":' },
    expected: invalid,
  },
  {
    name: '400: a JSON array instead of an object',
    vehicle: AGING,
    rawBody: { contentType: 'application/json', payload: '[]' },
    expected: invalid,
  },
  {
    name: '400: valid JSON sent as text/plain',
    vehicle: AGING,
    rawBody: { contentType: 'text/plain', payload: JSON.stringify(valid) },
    expected: invalid,
  },
  // Existing history (BR-13, BR-18): an accepted entry is appended, a rejection changes nothing
  {
    name: 'BR-13: an action on a vehicle with history is appended to it',
    vehicle: AGING,
    priorActions: 2,
    body: valid,
    expected: { ...accepted(valid), storedCount: 3 },
  },
  {
    name: 'BR-18: an invalid body on a vehicle with history leaves it unchanged',
    vehicle: AGING,
    priorActions: 2,
    body: { ...valid, loggedBy: ZWSP },
    expected: { ...invalid, storedCount: 2 },
  },
  {
    name: 'BR-18: a non-aging vehicle with history is rejected and keeps it (AC-006.2)',
    vehicle: { ageDays: 45 },
    priorActions: 1,
    body: valid,
    expected: { status: 422, code: 'VEHICLE_NOT_AGING', storedCount: 1 },
  },
  // 404 and precedence
  {
    name: '404: an unknown vehicle',
    vehicle: AGING,
    pathId: UNKNOWN_VEHICLE_ID,
    body: valid,
    expected: { status: 404, code: 'NOT_FOUND', storedCount: 0 },
  },
  {
    name: 'precedence: an invalid body on an unknown vehicle is 400, not 404',
    vehicle: AGING,
    pathId: UNKNOWN_VEHICLE_ID,
    body: { ...valid, loggedBy: '   ' },
    expected: invalid,
  },
  {
    name: 'precedence: an invalid body on a non-aging vehicle is 400, not 422',
    vehicle: { ageDays: 90 },
    body: { ...valid, status: 'Sold' },
    expected: invalid,
  },
  {
    name: '400: a non-canonical vehicle id (1e0)',
    vehicle: AGING,
    pathId: '1e0',
    body: valid,
    expected: invalid,
  },
  {
    name: '400: a non-numeric vehicle id',
    vehicle: AGING,
    pathId: 'abc',
    body: valid,
    expected: invalid,
  },
  {
    name: '400: vehicle id 0',
    vehicle: AGING,
    pathId: '0',
    body: valid,
    expected: invalid,
  },
  {
    name: '400: vehicle id -1',
    vehicle: AGING,
    pathId: '-1',
    body: valid,
    expected: invalid,
  },
];
