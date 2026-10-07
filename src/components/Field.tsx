import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useFieldIds } from '@/lib/use-field-ids';

/** Props a `Field` hands to its control: spread them onto the input/select. */
export type FieldControlProps = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
};

type Props = {
  label: ReactNode;
  /** Helper text, always linked to the control. */
  hint?: ReactNode;
  /** Validation message: shown as text, sets `aria-invalid` and is linked to the control. */
  error?: ReactNode;
  /** Control id; generated when omitted. */
  id?: string;
  /** `stacked` puts the label above the control; `inline` beside it (compact toolbars). */
  layout?: 'stacked' | 'inline';
  className?: string;
  labelClassName?: string;
  children: (control: FieldControlProps) => ReactNode;
};

/**
 * Label + control + optional hint and error, wired for assistive tech (skill section 7, NFR-01):
 * the label names the control, hint and error describe it (`aria-describedby`), and an error
 * marks it `aria-invalid`. The control is rendered through a render prop so any native control
 * (TextInput, Select, a textarea) can be used without cloning elements.
 */
export function Field({
  label,
  hint,
  error,
  id,
  layout = 'stacked',
  className,
  labelClassName,
  children,
}: Props) {
  const { hintId, errorId, hasHint, hasError, controlProps } = useFieldIds({ id, hint, error });

  return (
    <div
      className={cn(
        layout === 'inline' ? 'flex flex-wrap items-center gap-2' : 'flex flex-col gap-1',
        'text-sm',
        className,
      )}
    >
      <label htmlFor={controlProps.id} className={cn('font-medium text-slate-700', labelClassName)}>
        {label}
      </label>
      {children(controlProps)}
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
