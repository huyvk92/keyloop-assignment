import { act, render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n';
import { usePageHeading } from '@/lib/use-page-heading';

function Page({ title, moveFocus }: { title: string; moveFocus?: boolean }) {
  const ref = usePageHeading(title, { moveFocus });
  return (
    <h1 ref={ref} tabIndex={-1}>
      {title}
    </h1>
  );
}

function TranslatedPage() {
  const { t } = useTranslation();
  return (
    <>
      <Page title={t('app.title')} />
      <button type="button">Elsewhere</button>
    </>
  );
}

describe('usePageHeading', () => {
  it('sets the document title and focuses the heading, again when the title changes', () => {
    const { rerender } = render(<Page title="Leeds" />);

    expect(document.title).toBe('Leeds · Inventory dashboard');
    expect(screen.getByRole('heading', { name: 'Leeds' })).toHaveFocus();

    rerender(<Page title="Inventory dashboard" />);
    expect(document.title).toBe('Inventory dashboard');
    expect(screen.getByRole('heading', { name: 'Inventory dashboard' })).toHaveFocus();
  });

  it('translates the document title on a language switch without moving focus (AC-015.2)', async () => {
    const { rerender } = render(<Page title="Leeds" />);
    expect(screen.getByRole('heading', { name: 'Leeds' })).toHaveFocus();

    rerender(<TranslatedPage />);
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    elsewhere.focus();

    await act(() => i18n.changeLanguage('vi'));

    expect(screen.getByRole('heading', { name: 'Bảng điều khiển tồn kho' })).toBeVisible();
    expect(document.title).toBe('Bảng điều khiển tồn kho');
    expect(elsewhere).toHaveFocus();
  });

  it('keeps the dealership name untranslated in the Vietnamese document title', async () => {
    await act(() => i18n.changeLanguage('vi'));
    render(<Page title="Leeds" />);

    expect(document.title).toBe('Leeds · Bảng điều khiển tồn kho');
  });

  it('keeps focus where it is on a title change when moveFocus is false', () => {
    function WithControl({ title, moveFocus }: { title: string; moveFocus: boolean }) {
      return (
        <>
          <Page title={title} moveFocus={moveFocus} />
          <button type="button">Control</button>
        </>
      );
    }
    const { rerender } = render(<WithControl title="Birmingham" moveFocus />);
    const control = screen.getByRole('button', { name: 'Control' });
    control.focus();

    rerender(<WithControl title="Leeds" moveFocus={false} />);
    expect(document.title).toBe('Leeds · Inventory dashboard');
    expect(control).toHaveFocus();

    // Only moveFocus flipping back (e.g. a later page-param navigation) does not steal focus.
    rerender(<WithControl title="Leeds" moveFocus />);
    expect(control).toHaveFocus();

    // A real title change with moveFocus focuses the heading again (e.g. browser Back).
    rerender(<WithControl title="Birmingham" moveFocus />);
    expect(screen.getByRole('heading', { name: 'Birmingham' })).toHaveFocus();
  });

  it('focuses the heading on first render even when moveFocus is false (e.g. a reload)', () => {
    render(<Page title="Leeds" moveFocus={false} />);

    expect(screen.getByRole('heading', { name: 'Leeds' })).toHaveFocus();
  });
});
