import { ACTION_STATUSES } from '@shared/api/actions';
import { within } from '@testing-library/react';
import { i18n } from '@/i18n';
import { HttpError } from '@/lib/http';
import { renderWithProviders } from '@/test/render';
import { LogActionForm } from './LogActionForm';

type Submit = (body: unknown) => Promise<unknown>;

/**
 * Every query goes through the test's own container (not `screen`), so a test that timed out and
 * keeps running can't type into or click the next test's form.
 */
function renderForm(onSubmit = vi.fn<Submit>().mockResolvedValue({})) {
  const view = renderWithProviders(<LogActionForm onSubmit={onSubmit} />);
  const ui = within(view.container);
  return {
    ...view,
    onSubmit,
    ui,
    statusGroup: () => ui.getByRole('radiogroup', { name: 'Action status' }),
    noteBox: () => ui.getByRole('textbox', { name: 'Note (optional)' }),
    loggedByBox: () => ui.getByRole('textbox', { name: 'Logged by' }),
    saveButton: () => ui.getByRole('button', { name: /save action|saving/i }),
  };
}

/** A promise the test settles by hand, to hold a save in flight. */
function deferred() {
  let resolve: (value: unknown) => void = () => {};
  const promise = new Promise<unknown>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('LogActionForm (T-031)', () => {
  it('offers exactly the 5 statuses in ACTION_STATUSES order as a labelled radio group (AC-006.1, TA-20)', () => {
    const { ui, statusGroup, noteBox, loggedByBox } = renderForm();

    const radios = within(statusGroup()).getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([...ACTION_STATUSES]);
    expect(radios).toEqual(ACTION_STATUSES.map((name) => ui.getByRole('radio', { name })));
    expect(noteBox()).toBeInTheDocument();
    expect(loggedByBox()).toBeInTheDocument();
    expect(ui.getByText('0 / 500')).toBeInTheDocument();
  });

  it('shows field errors, focuses the status group and does not submit when empty (AC-006.4)', async () => {
    const { user, onSubmit, ui, statusGroup, loggedByBox, saveButton } = renderForm();

    await user.click(saveButton());

    expect(await ui.findByText('Select an action status.')).toBeVisible();
    expect(ui.getByText('Enter your name.')).toBeVisible();
    expect(ui.getByRole('radio', { name: 'Price Reduction Planned' })).toHaveFocus();
    expect(statusGroup()).toHaveAttribute('aria-invalid', 'true');
    expect(statusGroup()).toHaveAccessibleDescription('Select an action status.');
    expect(loggedByBox()).toHaveAttribute('aria-invalid', 'true');
    expect(loggedByBox()).toHaveAccessibleDescription('Enter your name.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('focuses "Logged by" when the status is chosen but the name is only spaces (BR-12)', async () => {
    const { user, onSubmit, ui, loggedByBox, saveButton } = renderForm();

    await user.click(ui.getByRole('radio', { name: 'Under Review' }));
    await user.type(loggedByBox(), '   ');
    await user.click(saveButton());

    expect(await ui.findByText('Enter your name.')).toBeVisible();
    expect(loggedByBox()).toHaveFocus();
    expect(ui.queryByText('Select an action status.')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a 101-character name with the 100-character message (BR-12)', async () => {
    const { user, onSubmit, ui, loggedByBox, saveButton } = renderForm();

    await user.click(ui.getByRole('radio', { name: 'Under Review' }));
    await user.click(loggedByBox());
    await user.paste('j'.repeat(101));
    await user.click(saveButton());

    expect(await ui.findByText('Name must be 100 characters or fewer.')).toBeVisible();
    expect(loggedByBox()).toHaveAttribute('aria-invalid', 'true');
    expect(loggedByBox()).toHaveAccessibleDescription('Name must be 100 characters or fewer.');
    expect(loggedByBox()).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a 501-character note with the 500-character message (AC-006.5)', async () => {
    const { user, onSubmit, ui, noteBox, loggedByBox, saveButton } = renderForm();

    await user.click(ui.getByRole('radio', { name: 'Under Review' }));
    await user.click(noteBox());
    await user.paste('a'.repeat(501));
    await user.click(loggedByBox());
    await user.paste('Jane Smith');
    await user.click(saveButton());

    expect(await ui.findByText('Note must be 500 characters or fewer.')).toBeVisible();
    expect(ui.getByText('501 / 500')).toHaveClass('text-red-700');
    expect(noteBox()).toHaveAttribute('aria-invalid', 'true');
    expect(noteBox()).toHaveAccessibleDescription(
      'Up to 500 characters. 501 / 500 Note must be 500 characters or fewer.',
    );
    expect(noteBox()).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a 500-character note (with surrounding spaces) trimmed (AC-006.5, BR-11)', async () => {
    const { user, onSubmit, ui, noteBox, loggedByBox, saveButton } = renderForm();
    const note = 'b'.repeat(500);

    await user.click(ui.getByRole('radio', { name: 'Marketing Promotion' }));
    await user.click(noteBox());
    await user.paste(`  ${note}  `);
    await user.click(loggedByBox());
    await user.paste('  Jane Smith ');
    expect(ui.getByText('500 / 500')).toBeInTheDocument();
    await user.click(saveButton());

    expect(await ui.findByText('Action saved')).toBeVisible();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      status: 'Marketing Promotion',
      note,
      loggedBy: 'Jane Smith',
    });
  });

  it('counts characters, not UTF-16 units: 300 emoji are "300 / 500" and save (BR-11)', async () => {
    const { user, onSubmit, ui, noteBox, loggedByBox, saveButton } = renderForm();
    // Each is one code point but two UTF-16 units (600 units in total, over the limit by .length).
    const note = '🚗'.repeat(300);

    await user.click(ui.getByRole('radio', { name: 'Marketing Promotion' }));
    await user.click(noteBox());
    await user.paste(note);
    await user.click(loggedByBox());
    await user.paste('Jane Smith');

    expect(ui.getByText('300 / 500')).not.toHaveClass('text-red-700');
    await user.click(saveButton());

    expect(await ui.findByText('Action saved')).toBeVisible();
    expect(ui.queryByText('Note must be 500 characters or fewer.')).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      status: 'Marketing Promotion',
      note,
      loggedBy: 'Jane Smith',
    });
  });

  it('clears status and note after a save but keeps "Logged by"', async () => {
    const { user, ui, statusGroup, noteBox, loggedByBox, saveButton } = renderForm();

    await user.click(ui.getByRole('radio', { name: 'Under Review' }));
    await user.type(noteBox(), 'Tyres');
    await user.type(loggedByBox(), 'Jane');
    await user.click(saveButton());

    expect(await ui.findByRole('status')).toHaveTextContent('Action saved');
    for (const radio of within(statusGroup()).getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
    expect(noteBox()).toHaveValue('');
    expect(loggedByBox()).toHaveValue('Jane');
  });

  it('keeps keyboard focus on Save while saving and after the save; posts once (AC-006.7)', async () => {
    const save = deferred();
    const { user, onSubmit, ui, loggedByBox } = renderForm(vi.fn<Submit>(() => save.promise));

    await user.click(ui.getByRole('radio', { name: 'Under Review' }));
    await user.type(loggedByBox(), 'Jane');
    await user.tab();
    const button = ui.getByRole('button', { name: 'Save action' });
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');

    const saving = await ui.findByRole('button', { name: 'Saving…' });
    expect(saving).toHaveAttribute('aria-disabled', 'true');
    expect(saving).toHaveFocus();
    // Neither Enter on the busy button, a click, nor Enter in a field posts again.
    await user.keyboard('{Enter}');
    await user.click(saving);
    await user.type(loggedByBox(), '{Enter}');
    expect(onSubmit).toHaveBeenCalledOnce();

    await user.tab(); // from "Logged by" back to Save
    expect(saving).toHaveFocus();
    save.resolve({});

    expect(await ui.findByText('Action saved')).toBeVisible();
    expect(ui.getByRole('button', { name: 'Save action' })).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it('keeps every input after a failed save, focuses the alert, and retries from the keyboard (AC-006.7)', async () => {
    const onSubmit = vi
      .fn<Submit>()
      .mockRejectedValueOnce(new HttpError(503, 'Service Unavailable', { raw: 'stack trace' }))
      .mockResolvedValueOnce({});
    const { user, ui, noteBox, loggedByBox } = renderForm(onSubmit);

    await user.click(ui.getByRole('radio', { name: 'Price Reduction Planned' }));
    await user.type(noteBox(), 'Cut 5%');
    await user.type(loggedByBox(), 'Jane');
    await user.tab();
    await user.keyboard('{Enter}');

    const alert = await ui.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't save the action");
    expect(alert).toHaveTextContent('The server ran into a problem. Try again in a moment.');
    expect(alert).not.toHaveTextContent('stack trace');
    expect(alert).toHaveFocus();
    expect(ui.getByRole('radio', { name: 'Price Reduction Planned' })).toBeChecked();
    expect(noteBox()).toHaveValue('Cut 5%');
    expect(loggedByBox()).toHaveValue('Jane');
    expect(ui.getByRole('status')).toBeEmptyDOMElement();

    // One Tab from the alert reaches Save.
    await user.tab();
    expect(ui.getByRole('button', { name: 'Save action' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(await ui.findByText('Action saved')).toBeVisible();
    expect(ui.queryByRole('alert')).not.toBeInTheDocument();
    expect(ui.getByRole('button', { name: 'Save action' })).toHaveFocus();
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('shows the Vietnamese messages, never the contract English ones (BR-19)', async () => {
    await i18n.changeLanguage('vi');
    const { user, onSubmit, ui } = renderForm();

    expect(ui.getByRole('radiogroup', { name: 'Trạng thái hành động' })).toBeInTheDocument();
    // Values stay canonical; only the labels are translated.
    expect(ui.getByRole('radio', { name: 'Dự kiến giảm giá' })).toHaveAttribute(
      'value',
      'Price Reduction Planned',
    );
    await user.click(ui.getByRole('button', { name: 'Lưu hành động' }));

    expect(await ui.findByText('Vui lòng chọn trạng thái hành động.')).toBeVisible();
    expect(ui.getByText('Vui lòng nhập tên của bạn.')).toBeVisible();
    expect(ui.queryByText('Select a status')).not.toBeInTheDocument();
    expect(ui.queryByText('Enter your name')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
