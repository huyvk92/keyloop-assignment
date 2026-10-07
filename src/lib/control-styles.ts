/**
 * Shared Tailwind classes for native form controls (T-017). `aria-invalid` drives the error
 * border, so a control styled here turns red exactly when it is announced as invalid.
 */
export const controlSizes = {
  sm: 'h-8 px-2 text-sm',
  md: 'h-10 px-3 text-sm',
} as const;

export type ControlSize = keyof typeof controlSizes;

export const controlBase = [
  'rounded-md border border-slate-300 bg-white text-slate-900',
  'focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none',
  'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
  'aria-invalid:border-red-600 aria-invalid:focus-visible:ring-red-600',
].join(' ');
