import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextInput } from '@/components/TextInput';

describe('TextInput', () => {
  it('passes native props through and accepts typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextInput aria-label="Search" placeholder="Stock no. or VIN" onChange={onChange} />);

    const input = screen.getByRole('textbox', { name: 'Search' });
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('placeholder', 'Stock no. or VIN');
    await user.type(input, 'STK');

    expect(input).toHaveValue('STK');
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('keeps a given type and can be disabled', () => {
    render(<TextInput aria-label="Min days" type="number" disabled />);

    const input = screen.getByRole('spinbutton', { name: 'Min days' });
    expect(input).toBeDisabled();
  });
});
