import {
  ACTION_STATUSES,
  ActionEntrySchema,
  ActionStatusSchema,
  CurrentActionSchema,
} from './actions';

const entry = {
  id: 1,
  vehicleId: 42,
  status: 'Under Review',
  note: null,
  loggedBy: 'Jane Smith',
  loggedAt: '2026-10-07T09:00:00.000Z',
};

describe('ActionStatusSchema (BR-10)', () => {
  it('lists exactly the five PRD statuses in order', () => {
    expect(ACTION_STATUSES).toEqual([
      'Price Reduction Planned',
      'Marketing Promotion',
      'Transfer to Another Dealership',
      'Send to Auction/Wholesale',
      'Under Review',
    ]);
  });

  it.each(ACTION_STATUSES)('accepts "%s"', (status) => {
    expect(ActionStatusSchema.parse(status)).toBe(status);
  });

  it('rejects an unknown or differently cased status with a user-facing message', () => {
    const result = ActionStatusSchema.safeParse('Sold');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Select a status');
    expect(ActionStatusSchema.safeParse('under review').success).toBe(false);
  });
});

describe('ActionEntrySchema', () => {
  it('accepts an entry with a null note and a UTC timestamp', () => {
    expect(ActionEntrySchema.parse(entry)).toEqual(entry);
  });

  it('rejects an unknown status and a non-ISO timestamp', () => {
    expect(ActionEntrySchema.safeParse({ ...entry, status: 'Sold' }).success).toBe(false);
    expect(ActionEntrySchema.safeParse({ ...entry, loggedAt: '07/10/2026' }).success).toBe(false);
  });

  it('CurrentAction keeps only status, loggedBy and loggedAt', () => {
    expect(CurrentActionSchema.parse(entry)).toEqual({
      status: 'Under Review',
      loggedBy: 'Jane Smith',
      loggedAt: '2026-10-07T09:00:00.000Z',
    });
  });
});
