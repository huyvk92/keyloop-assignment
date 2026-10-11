import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from '@/components/Field';
import { Select } from '@/components/Select';
import { TextInput } from '@/components/TextInput';

describe('Field', () => {
  it('labels its control so it can be found by label', () => {
    render(<Field label="Your name">{(control) => <TextInput {...control} />}</Field>);

    const input = screen.getByLabelText('Your name');
    expect(input).toHaveRole('textbox');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('describes the control with the hint', () => {
    render(
      <Field label="Note" hint="Up to 500 characters">
        {(control) => <TextInput {...control} />}
      </Field>,
    );

    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveAccessibleDescription(
      'Up to 500 characters',
    );
  });

  it('keeps a restyled (compact) hint linked to the control', () => {
    render(
      <Field label="Search" hint="VIN or model" hintClassName="text-xs">
        {(control) => <TextInput {...control} />}
      </Field>,
    );

    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveAccessibleDescription(
      'VIN or model',
    );
    expect(screen.getByText('VIN or model')).toHaveClass('text-xs');
  });

  it('marks the control invalid and links the visible error text (AC-006.4)', () => {
    render(
      <Field label="Your name" hint="As it should appear in the history" error="Enter your name">
        {(control) => <TextInput {...control} />}
      </Field>,
    );

    const input = screen.getByRole('textbox', { name: 'Your name' });
    const error = screen.getByText('Enter your name');
    expect(error).toBeVisible();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
    expect(input).toHaveAccessibleDescription('As it should appear in the history Enter your name');
  });

  it('wires a select the same way', () => {
    render(
      <Field label="Make" error="Choose a make">
        {(control) => (
          <Select {...control}>
            <option value="">Any</option>
          </Select>
        )}
      </Field>,
    );

    const select = screen.getByRole('combobox', { name: 'Make' });
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Choose a make');
  });

  it('focuses the control when the label is clicked', async () => {
    const user = userEvent.setup();
    render(<Field label="Search">{(control) => <TextInput {...control} />}</Field>);

    await user.click(screen.getByText('Search'));

    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
  });

  it('uses a given id for the control', () => {
    render(
      <Field id="stock-search" label="Search">
        {(control) => <TextInput {...control} />}
      </Field>,
    );

    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveAttribute('id', 'stock-search');
  });
});
