import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '@/components/Checkbox';

describe('Checkbox', () => {
  it('is labelled and toggles with the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Aging only" onChange={onChange} />);

    await user.tab();
    const checkbox = screen.getByRole('checkbox', { name: 'Aging only' });
    expect(checkbox).toHaveFocus();
    await user.keyboard(' ');

    expect(checkbox).toBeChecked();
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('toggles when its label is clicked', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Aging only" />);

    await user.click(screen.getByText('Aging only'));

    expect(screen.getByRole('checkbox', { name: 'Aging only' })).toBeChecked();
  });

  it('links hint and error, and marks itself invalid', () => {
    render(
      <Checkbox label="I confirm" hint="Required before saving" error="Confirm to continue" />,
    );

    const checkbox = screen.getByRole('checkbox', { name: 'I confirm' });
    expect(screen.getByText('Confirm to continue')).toBeVisible();
    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    expect(checkbox).toHaveAccessibleDescription('Required before saving Confirm to continue');
  });

  it('is valid and undescribed by default', () => {
    render(<Checkbox label="Aging only" />);

    const checkbox = screen.getByRole('checkbox', { name: 'Aging only' });
    expect(checkbox).not.toHaveAttribute('aria-invalid');
    expect(checkbox).not.toHaveAttribute('aria-describedby');
  });
});
