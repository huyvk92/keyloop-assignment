import { KEEP_FOCUS_STATE, shouldKeepFocus } from '@/lib/navigation-focus';

describe('navigation focus state', () => {
  it('recognises the keep-focus state', () => {
    expect(shouldKeepFocus(KEEP_FOCUS_STATE)).toBe(true);
  });

  it.each([null, undefined, {}, { keepFocus: 'yes' }, 'keepFocus'])(
    'ignores anything else (%j)',
    (state) => {
      expect(shouldKeepFocus(state)).toBe(false);
    },
  );
});
