import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { controlBase, controlSizes, type ControlSize } from '@/lib/control-styles';

type Props = Omit<ComponentProps<'select'>, 'size'> & {
  size?: ControlSize;
  /** Applied to the wrapper, so width utilities (`min-w-40`, `w-full`) size the whole control. */
  className?: string;
};

/** Right padding reserves room for the chevron; the chevron sits inset from the border. */
const chevronLayout = {
  sm: { select: 'pr-8', icon: 'right-2' },
  md: { select: 'pr-9', icon: 'right-3' },
} as const satisfies Record<ControlSize, { select: string; icon: string }>;

/**
 * Styled native `<select>` (TA-02): the browser provides keyboard operation, type-ahead and
 * the mobile picker, so no custom listbox is needed. Pass `<option>`s as children.
 * The native arrow is replaced (`appearance-none`) by a chevron with consistent inner padding.
 */
export function Select({ size = 'md', className, children, ...props }: Props) {
  return (
    <span className={cn('relative inline-flex', className)}>
      <select
        className={cn(
          controlBase,
          controlSizes[size],
          chevronLayout[size].select,
          'w-full appearance-none',
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={cn(
          'pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-slate-500',
          chevronLayout[size].icon,
        )}
      >
        <path
          fillRule="evenodd"
          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}
