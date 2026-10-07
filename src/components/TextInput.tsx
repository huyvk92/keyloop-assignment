import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { controlBase, controlSizes, type ControlSize } from '@/lib/control-styles';

type Props = Omit<ComponentProps<'input'>, 'size'> & { size?: ControlSize };

/** Styled native `<input>`; pair with `Field` for the label, hint and error wiring. */
export function TextInput({ size = 'md', type = 'text', className, ...props }: Props) {
  return (
    <input
      type={type}
      className={cn(controlBase, controlSizes[size], 'w-full', className)}
      {...props}
    />
  );
}
