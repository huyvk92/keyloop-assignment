import { act, render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n';
import { usePageHeading } from '@/lib/use-page-heading';

function Page({ title }: { title: string }) {
  const ref = usePageHeading(title);
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
});
