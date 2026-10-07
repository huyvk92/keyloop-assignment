import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useFieldIds } from '@/lib/use-field-ids';

type Props = Omit<ComponentProps<'input'>, 'type'> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
};

/**
 * Native checkbox with its label beside it. Hint and error are linked with `aria-describedby`;
 * an error sets `aria-invalid` and is shown as text (skill section 7).
 */
export function Checkbox({ label, hint, error, id, className, ...props }: Props) {
  const { hintId, errorId, hasHint, hasError, controlProps } = useFieldIds({ id, hint, error });

  return (
    <div className={cn('flex flex-col gap-1 text-sm', className)}>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          {...controlProps}
          className={cn(
            'size-4 rounded border-slate-300 accent-brand-600',
            'focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none',
            'disabled:cursor-not-allowed',
          )}
          {...props}
        />
        <label htmlFor={controlProps.id} className="text-slate-700">
          {label}
        </label>
      </div>
      {hasHint && (
        <p id={hintId} className="text-slate-600">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
