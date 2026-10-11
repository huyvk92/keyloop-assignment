/**
 * WCAG 2.x contrast for the design tokens (T-038, NFR-01). Tailwind v4 defines colours as
 * `oklch(L C H)`; this converts them to sRGB (OKLab → linear sRGB, Björn Ottosson's matrices) and
 * applies the WCAG relative-luminance formula. Pure functions, used by the token contrast test.
 */

type Rgb = readonly [r: number, g: number, b: number];

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Parses `oklch(98.4% 0.003 247.858)` or `oklch(0.984 0.003 247.858)`; `undefined` otherwise. */
export function parseOklch(value: string): { l: number; c: number; h: number } | undefined {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value.trim());
  if (!match) return undefined;
  const [, lightness = '', percent, chroma = '', hue = ''] = match;
  const l = Number(lightness) / (percent ? 100 : 1);
  return { l, c: Number(chroma), h: Number(hue) };
}

/** Linear-light sRGB (0..1, gamut-clamped) of an OKLCH colour. */
export function oklchToLinearSrgb({ l, c, h }: { l: number; c: number; h: number }): Rgb {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

/** WCAG relative luminance of a linear-light sRGB colour. */
export const relativeLuminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** WCAG contrast ratio (1..21) between two `oklch()` colours, or `white`. */
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (value: string) => {
    if (value === 'white') return 1;
    const parsed = parseOklch(value);
    if (!parsed) throw new Error(`Not an oklch() colour: ${value}`);
    return relativeLuminance(oklchToLinearSrgb(parsed));
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** `--color-<name>: <value>;` declarations of a CSS file, by colour name (e.g. `slate-500`). */
export function readColorTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const [, name = '', value = ''] of css.matchAll(/--color-([\w-]+):\s*([^;]+);/g)) {
    tokens.set(name, value.trim());
  }
  return tokens;
}
