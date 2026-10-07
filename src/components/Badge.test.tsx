import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/Badge';

describe('Badge', () => {
  it('renders its text label so status is not conveyed by colour alone', () => {
    render(<Badge tone="aging">Aging</Badge>);

    expect(screen.getByText('Aging')).toBeVisible();
  });

  it('hides the decorative icon from assistive technologies', () => {
    render(
      <Badge tone="attention" icon={<svg role="img" aria-label="warning icon" />}>
        Needs attention
      </Badge>,
    );

    expect(screen.queryByRole('img', { name: 'warning icon' })).not.toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeVisible();
  });
});
