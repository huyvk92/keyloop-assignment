import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { i18n, LANGUAGE_STORAGE_KEY } from '@/i18n';

describe('LanguageSwitcher', () => {
  it('has an accessible name and announces each option in its own language (AC-015.6)', () => {
    render(<LanguageSwitcher />);

    const select = screen.getByRole('combobox', { name: 'Language' });
    expect(select).toHaveValue('en');
    expect(screen.getByRole('option', { name: 'English' })).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('option', { name: 'Tiếng Việt' })).toHaveAttribute('lang', 'vi');
  });

  it('switches to Vietnamese, declares it on <html> and remembers it (AC-015.2, AC-015.3)', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'Tiếng Việt');

    expect(i18n.language).toBe('vi');
    expect(document.documentElement.lang).toBe('vi');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
    // The label follows the language; the selection is kept.
    expect(screen.getByRole('combobox', { name: 'Ngôn ngữ' })).toHaveValue('vi');
  });

  it('is reachable with Tab and keeps focus after switching (AC-015.6)', async () => {
    // Arrow-key selection on a native <select> is provided by the browser; jsdom does not
    // emulate it, so the change itself is driven with selectOptions on the focused control.
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.tab();
    const select = screen.getByRole('combobox', { name: 'Language' });
    expect(select).toHaveFocus();

    await user.selectOptions(select, 'vi');
    expect(i18n.language).toBe('vi');
    expect(screen.getByRole('combobox', { name: 'Ngôn ngữ' })).toHaveFocus();

    await user.selectOptions(select, 'en');
    expect(i18n.language).toBe('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
