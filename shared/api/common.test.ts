import { intParam } from './common';

describe('intParam', () => {
  it('with min 1 rejects 0 and accepts 1', () => {
    const schema = intParam({ min: 1 });

    expect(schema.safeParse('0').success).toBe(false);
    expect(schema.safeParse(0).success).toBe(false);
    expect(schema.parse('1')).toBe(1);
  });

  it('defaults the upper bound to the safe-integer range', () => {
    const schema = intParam({ min: 1 });

    expect(schema.parse(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(schema.safeParse('9007199254740993').success).toBe(false);
  });

  describe('with min 0 and a max', () => {
    const schema = intParam({ min: 0, max: 500 });

    it.each([
      ['0', 0],
      [0, 0],
      ['45', 45],
      [500, 500],
      ['500', 500],
    ])('accepts the canonical whole number %j', (value, expected) => {
      expect(schema.parse(value)).toBe(expected);
    });

    it.each(['0x1', '1e2', '1.5', '-1', ' 2', '2 ', '+2', '', 'abc', '501', -1, 1.5, 501])(
      'rejects %j',
      (value) => {
        expect(schema.safeParse(value).success).toBe(false);
      },
    );
  });
});
