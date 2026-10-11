import { useId, type ReactNode } from 'react';

type Options = { id?: string; hint?: ReactNode; error?: ReactNode };

function hasContent(node: ReactNode): boolean {
  return node != null && node !== false && node !== '';
}

/**
 * Ids and ARIA attributes linking a form control to its hint and error (skill section 7):
 * hint and error ids go in `aria-describedby` (hint first), an error sets `aria-invalid`.
 * Shared by `Field` and `Checkbox` so both wire assistive tech identically.
 */
export function useFieldIds({ id, hint, error }: Options) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const hasHint = hasContent(hint);
  const hasError = hasContent(error);
  const describedBy = [hasHint && hintId, hasError && errorId].filter(Boolean).join(' ');

  return {
    hintId,
    errorId,
    hasHint,
    hasError,
    controlProps: {
      id: controlId,
      'aria-describedby': describedBy || undefined,
      'aria-invalid': hasError ? (true as const) : undefined,
    },
  };
}
