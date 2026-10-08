import { render, screen } from '@testing-library/react';
import { AttentionBadge } from '@/features/inventory';
import { i18n } from '@/i18n';

describe('AttentionBadge', () => {
  it('shows a visible "Needs attention" text label, not colour alone (AC-010.1)', () => {
    render(<AttentionBadge />);

    // The icon is aria-hidden and adds no text, so the label is exactly "Needs attention".
    expect(screen.getByText('Needs attention')).toBeVisible();
    expect(screen.getByText('Needs attention')).toHaveTextContent(/^Needs attention$/);
  });

  it('shows the Vietnamese label when Vietnamese is selected (BR-19)', async () => {
    await i18n.changeLanguage('vi');
    render(<AttentionBadge />);

    expect(screen.getByText('Cần xử lý')).toBeVisible();
  });
});
