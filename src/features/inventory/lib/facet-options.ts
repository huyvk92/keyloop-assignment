import type { FacetsResponse } from '@shared/api/vehicles';

/** ASCII case-insensitive A-Z, like the API's facets (TA-27). */
const byText = (a: string, b: string) => {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()];
  return x < y ? -1 : x > y ? 1 : 0;
};

/**
 * Model options for the selected make (BR-06): that make's models, or every model in the
 * dealership's stock (distinct, A-Z) when no make is selected. An unknown make offers none.
 */
export function modelOptions(facets: FacetsResponse | undefined, make: string | undefined) {
  if (!facets) return [];
  if (make !== undefined) return facets.makes.find((facet) => facet.make === make)?.models ?? [];
  return [...new Set(facets.makes.flatMap((facet) => facet.models))].sort(byText);
}

/**
 * Adds the selected value when it isn't among the options (facets still loading, or a value
 * from a shared URL that no longer exists), so a native select still shows what is applied.
 */
export function withCurrent(options: string[], current: string | undefined): string[] {
  return current === undefined || options.includes(current) ? options : [current, ...options];
}
