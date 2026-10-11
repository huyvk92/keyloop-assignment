import tailwindTheme from 'tailwindcss/theme.css?raw';
import appTheme from '@/index.css?raw';
import { contrastRatio, parseOklch, readColorTokens } from '@/lib/contrast';

// The tokens the app actually renders: Tailwind's palette, overridden/extended by src/index.css.
const tokens = new Map([...readColorTokens(tailwindTheme), ...readColorTokens(appTheme)]);
const color = (name: string) => {
  if (name === 'white') return 'white';
  const value = tokens.get(name);
  if (!value) throw new Error(`Unknown colour token: ${name}`);
  return value;
};
const ratio = (foreground: string, background: string) =>
  contrastRatio(color(foreground), color(background));

describe('contrast helpers', () => {
  it('parses percentage and fractional lightness', () => {
    const percent = parseOklch('oklch(55.4% 0.046 257.417)');
    expect(percent?.l).toBeCloseTo(0.554);
    expect(percent).toMatchObject({ c: 0.046, h: 257.417 });
    expect(parseOklch('oklch(0.55 0.18 250)')).toEqual({ l: 0.55, c: 0.18, h: 250 });
    expect(parseOklch('#fff')).toBeUndefined();
  });

  it('gives the WCAG extremes for white on white and black on white', () => {
    expect(contrastRatio('white', 'white')).toBeCloseTo(1);
    expect(contrastRatio('oklch(0 0 0)', 'white')).toBeCloseTo(21);
  });

  it('throws for a value that is not oklch()', () => {
    expect(() => contrastRatio('#000', 'white')).toThrow(/oklch/);
  });
});

/**
 * WCAG 2.1 AA for the colour pairs the UI renders (T-038, NFR-01): 4.5:1 for normal-size text
 * (1.4.3), 3:1 for focus indicators and the boundaries of form controls (1.4.11). Disabled
 * controls are exempt. A token change that breaks a pair fails here.
 */
describe('design token contrast (WCAG 2.1 AA)', () => {
  it.each([
    ['aging-800', 'aging-50', 'Aging badge'],
    ['attention-800', 'attention-50', 'Needs attention badge, error state'],
    ['slate-700', 'slate-50', 'neutral badge, table header'],
    ['slate-600', 'white', 'muted text (hints, labels, "Last updated")'],
    ['slate-600', 'slate-50', 'muted text on the page background (footer) and hovered rows'],
    ['slate-500', 'white', 'the "not aging" dash'],
    ['slate-500', 'slate-50', 'the "not aging" dash in a hovered row'],
    ['brand-600', 'white', 'links'],
    ['white', 'brand-600', 'primary button'],
    ['white', 'brand-700', 'hovered primary button'],
    ['red-700', 'white', 'field errors'],
    ['green-700', 'white', '"Action saved"'],
  ])('text %s on %s is at least 4.5:1 (%s)', (foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['brand-500', 'white', 'focus ring'],
    ['brand-500', 'slate-50', 'focus ring on the page background'],
    ['brand-500', 'attention-50', 'focus ring around Retry in an error state'],
    ['red-600', 'white', 'invalid control border and focus ring'],
    ['slate-500', 'white', 'text input and select borders, select chevron'],
    ['slate-500', 'slate-50', 'unsorted column icon in the table header'],
  ])('UI %s on %s is at least 3:1 (%s)', (foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(3);
  });

  it('flags the light greys that are only used decoratively (guards against reuse for text)', () => {
    expect(ratio('slate-400', 'white')).toBeLessThan(3);
    expect(ratio('slate-300', 'white')).toBeLessThan(3);
  });
});
