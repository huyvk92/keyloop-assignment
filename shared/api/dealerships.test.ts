import { DealershipListResponseSchema, DealershipParamsSchema } from './dealerships';

describe('dealership contract', () => {
  it('parses a dealership list', () => {
    const body = {
      items: [
        { id: 1, name: 'Birmingham Central Motors', currency: 'GBP', timeZone: 'Europe/London' },
      ],
    };
    expect(DealershipListResponseSchema.parse(body)).toEqual(body);
  });

  it('rejects a currency that is not a 3-letter code', () => {
    const bad = { items: [{ id: 1, name: 'X', currency: 'GB', timeZone: 'Europe/London' }] };
    expect(DealershipListResponseSchema.safeParse(bad).success).toBe(false);
  });

  it('coerces the dealershipId path param and rejects non-positive or non-numeric ids', () => {
    expect(DealershipParamsSchema.parse({ dealershipId: '2' })).toEqual({ dealershipId: 2 });
    expect(DealershipParamsSchema.safeParse({ dealershipId: 'abc' }).success).toBe(false);
    expect(DealershipParamsSchema.safeParse({ dealershipId: '0' }).success).toBe(false);
  });

  it.each(['0x1', '1e2', '1.5', '-1', ' 2', '2 ', '+2', ''])(
    'rejects the non-canonical dealershipId %j',
    (dealershipId) => {
      expect(DealershipParamsSchema.safeParse({ dealershipId }).success).toBe(false);
    },
  );

  it.each([['2'], [2]])('accepts the canonical dealershipId %j', (dealershipId) => {
    expect(DealershipParamsSchema.parse({ dealershipId })).toEqual({ dealershipId: 2 });
  });
});
