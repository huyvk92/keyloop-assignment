import type { ComponentProps, MouseEvent } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-slate-100',
} satisfies Record<Variant, string>;

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
} satisfies Record<Size, string>;

type Props = ComponentProps<'button'> & {
  variant?: Variant;
  size?: Size;
  /**
   * Busy (e.g. saving): the button stays focusable but is `aria-disabled` and ignores clicks,
   * including the click that submits a form. Unlike `disabled`, it doesn't drop keyboard focus to
   * `<body>` (Chromium blurs a focused button when it becomes disabled). A form should still guard
   * its own submit handler, since Enter in a field can submit without a click.
   */
  isLoading?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  children,
  type = 'button',
  onClick,
  ...props
}: Props) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isLoading) {
      // Blocks the default action too, so a busy submit button doesn't submit its form again.
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <button
      type={type}
      aria-disabled={isLoading || undefined}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      {isLoading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
