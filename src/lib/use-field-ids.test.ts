import { renderHook } from '@testing-library/react';
import { useFieldIds } from '@/lib/use-field-ids';

describe('useFieldIds', () => {
  it('leaves the control undescribed and valid without hint or error', () => {
    const { result } = renderHook(() => useFieldIds({ id: 'make' }));

    expect(result.current.controlProps).toEqual({
      id: 'make',
      'aria-describedby': undefined,
      'aria-invalid': undefined,
    });
    expect(result.current.hasHint).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it('lists the hint before the error and marks the control invalid', () => {
    const { result } = renderHook(() =>
      useFieldIds({ id: 'name', hint: 'Shown in history', error: 'Enter your name' }),
    );

    expect(result.current.controlProps).toEqual({
      id: 'name',
      'aria-describedby': 'name-hint name-error',
      'aria-invalid': true,
    });
  });

  it.each([null, false, ''])('treats %j as no error', (error) => {
    const { result } = renderHook(() => useFieldIds({ error }));

    expect(result.current.hasError).toBe(false);
    expect(result.current.controlProps['aria-invalid']).toBeUndefined();
  });

  it('generates a stable id when none is given', () => {
    const { result, rerender } = renderHook(() => useFieldIds({}));
    const first = result.current.controlProps.id;
    rerender();

    expect(first).toBeTruthy();
    expect(result.current.controlProps.id).toBe(first);
  });
});
