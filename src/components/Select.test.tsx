import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from '@/components/Select';

describe('Select', () => {
  it('is a native select operable with the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select aria-label="Make" defaultValue="" onChange={onChange}>
        <option value="">Any</option>
        <option value="Ford">Ford</option>
        <option value="Toyota">Toyota</option>
      </Select>,
    );

    await user.tab();
    const select = screen.getByRole('combobox', { name: 'Make' });
    expect(select).toHaveFocus();
    expect(select.tagName).toBe('SELECT');

    await user.selectOptions(select, 'Toyota');

    expect(select).toHaveValue('Toyota');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('can be disabled', () => {
    render(
      <Select aria-label="Make" disabled>
        <option>Any</option>
      </Select>,
    );

    expect(screen.getByRole('combobox', { name: 'Make' })).toBeDisabled();
  });
});
