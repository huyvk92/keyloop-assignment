import { render, screen } from '@testing-library/react';
import { AgingBadge } from '@/features/inventory';
import { i18n } from '@/i18n';

describe('AgingBadge', () => {
  it('shows a visible "Aging" text label, not colour alone (AC-003.4)', () => {
    render(<AgingBadge />);

    // The icon is aria-hidden and adds no text, so the label is exactly "Aging".
    expect(screen.getByText('Aging')).toBeVisible();
    expect(screen.getByText('Aging')).toHaveTextContent(/^Aging$/);
  });

  it('shows the Vietnamese label when Vietnamese is selected', async () => {
    await i18n.changeLanguage('vi');
    render(<AgingBadge />);

    expect(screen.getByText('Tồn kho lâu')).toBeVisible();
  });
});
