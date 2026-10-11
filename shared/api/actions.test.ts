import {
  ACTION_STATUSES,
  ActionEntrySchema,
  ActionStatusSchema,
  CreateActionBodySchema,
  CurrentActionSchema,
  isBlankText,
  LOGGED_BY_MAX_LENGTH,
  NOTE_MAX_LENGTH,
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

describe('CreateActionBodySchema (T-025)', () => {
  const body = { status: 'Price Reduction Planned', note: 'Reduce by 5%', loggedBy: 'Jane Smith' };
  /** Messages of the issues on one field (what the form shows next to it). */
  const messages = (input: unknown, field: string) =>
    (CreateActionBodySchema.safeParse(input).error?.issues ?? [])
      .filter((issue) => issue.path[0] === field)
      .map((issue) => issue.message);

  it('accepts the AC-006.3 example and an omitted note', () => {
    expect(CreateActionBodySchema.parse(body)).toEqual(body);
    const withoutNote = { status: body.status, loggedBy: body.loggedBy };
    expect(CreateActionBodySchema.parse(withoutNote)).toEqual(withoutNote);
  });

  it('exposes the PRD limits', () => {
    expect(NOTE_MAX_LENGTH).toBe(500);
    expect(LOGGED_BY_MAX_LENGTH).toBe(100);
  });

  describe('status (BR-10, AC-006.4, AC-006.6)', () => {
    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['unknown', 'Sold'],
      ['differently cased', 'under review'],
    ])('rejects a %s status with "Select a status"', (_label, status) => {
      expect(messages({ ...body, status }, 'status')).toEqual(['Select a status']);
    });
  });

  describe('note (BR-11, AC-006.5)', () => {
    it('accepts 500 characters and rejects 501 with the limit in the message', () => {
      expect(CreateActionBodySchema.parse({ ...body, note: 'n'.repeat(500) }).note).toHaveLength(
        500,
      );
      expect(messages({ ...body, note: 'n'.repeat(501) }, 'note')).toEqual([
        'Note must be 500 characters or fewer',
      ]);
    });

    it('trims before the length check: 500 characters plus surrounding spaces is accepted', () => {
      const note = 'n'.repeat(500);
      expect(CreateActionBodySchema.parse({ ...body, note: `  ${note}\n ` }).note).toBe(note);
    });

    it('turns a whitespace-only note into an empty string (stored as NULL, TA-17)', () => {
      expect(CreateActionBodySchema.parse({ ...body, note: '  \t ' }).note).toBe('');
    });

    it.each([
      ['a zero-width space', '\u200B'],
      ['zero-width characters and spaces', ' \u200B\u200C\u200D\u2060 \uFEFF '],
      ['a no-break space and a soft hyphen', '\u00A0\u00AD'],
    ])('turns a note of only %s into an empty string (stored as NULL, TA-17)', (_label, note) => {
      expect(CreateActionBodySchema.parse({ ...body, note }).note).toBe('');
    });

    it('keeps a zero-width character inside real text', () => {
      expect(CreateActionBodySchema.parse({ ...body, note: ' a\u200Bb ' }).note).toBe('a\u200Bb');
    });

    it('keeps markup as literal text (AC-006.8)', () => {
      expect(CreateActionBodySchema.parse({ ...body, note: '<b>cut</b>' }).note).toBe('<b>cut</b>');
    });

    it('rejects a non-string note', () => {
      expect(CreateActionBodySchema.safeParse({ ...body, note: null }).success).toBe(false);
    });
  });

  describe('loggedBy (BR-12, AC-006.4)', () => {
    it.each([
      ['empty', ''],
      ['whitespace-only', '   '],
      ['zero-width-space-only', '\u200B'],
      ['invisible-only', ' \u200B\u200D\u2060\u00AD\u00A0 '],
    ])('rejects an %s name with "Enter your name" (BR-12)', (_label, loggedBy) => {
      expect(messages({ ...body, loggedBy }, 'loggedBy')).toEqual(['Enter your name']);
    });

    it('rejects a missing name', () => {
      const withoutName = { status: body.status, note: body.note };
      expect(messages(withoutName, 'loggedBy')).toHaveLength(1);
    });

    it('accepts 100 characters (after trimming) and rejects 101', () => {
      const name = 'j'.repeat(100);
      expect(CreateActionBodySchema.parse({ ...body, loggedBy: ` ${name} ` }).loggedBy).toBe(name);
      expect(messages({ ...body, loggedBy: 'j'.repeat(101) }, 'loggedBy')).toEqual([
        'Name must be 100 characters or fewer',
      ]);
    });

    it('stores the trimmed original when there is visible text (zero-width characters kept)', () => {
      expect(
        CreateActionBodySchema.parse({ ...body, loggedBy: ' \u200BJane Smith ' }).loggedBy,
      ).toBe('\u200BJane Smith');
    });

    it('trims the name in the output', () => {
      expect(CreateActionBodySchema.parse({ ...body, loggedBy: '  Jane Smith ' }).loggedBy).toBe(
        'Jane Smith',
      );
    });
  });

  describe('isBlankText (BR-12, TA-17)', () => {
    it.each(['', '   ', '\t\n', '\u200B', '\u200B \u200C', '\uFEFF', '\u00AD', '\u202E'])(
      'treats %j as blank',
      (value) => {
        expect(isBlankText(value)).toBe(true);
      },
    );

    it.each(['a', ' a ', '\u200Ba', '.', '0'])('treats %j as not blank', (value) => {
      expect(isBlankText(value)).toBe(false);
    });
  });

  it('strips unknown keys, so a client cannot set the id or timestamp (BR-13)', () => {
    expect(
      CreateActionBodySchema.parse({ ...body, id: 9, loggedAt: '2020-01-01T00:00:00.000Z' }),
    ).toEqual(body);
  });
});
