import { escapeLike } from './inventory.repository';

describe('escapeLike (BR-08)', () => {
  it('escapes %, _ and the escape character, leaving other text alone', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('back\\slash')).toBe('back\\\\slash');
    expect(escapeLike('STK-1042')).toBe('STK-1042');
  });
});
