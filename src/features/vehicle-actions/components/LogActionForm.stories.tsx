import preview from '#.storybook/preview';
import { expect, fn } from 'storybook/test';
import { LogActionForm } from './LogActionForm';

const meta = preview.meta({
  title: 'Vehicle actions/LogActionForm',
  component: LogActionForm,
  parameters: { layout: 'padded' },
  args: { onSubmit: fn(async () => {}) },
});

/** Five statuses in ACTION_STATUSES order, optional note with a counter, "Logged by" (AC-006.1). */
export const Default = meta.story({});

/** "Logged by" pre-filled with the name remembered from the last save, still editable (AC-012.1). */
export const RememberedName = meta.story({
  args: { defaultLoggedBy: 'Jane Smith' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox', { name: 'Logged by' })).toHaveValue('Jane Smith');
  },
});

/** Saving with nothing filled in: field errors, focus on the status group (AC-006.4). */
export const ValidationError = meta.story({
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save action' }));
    await expect(await canvas.findByText('Select an action status.')).toBeVisible();
    await expect(canvas.getByText('Enter your name.')).toBeVisible();
    await expect(canvas.getByRole('radio', { name: 'Price Reduction Planned' })).toHaveFocus();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
});

/** While the save is in flight, Save reads "Saving…", is aria-disabled and keeps focus. */
export const Submitting = meta.story({
  args: { onSubmit: fn(() => new Promise<never>(() => {})) },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Price Reduction Planned' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Note (optional)' }), 'Reduce by 5%');
    await userEvent.type(canvas.getByRole('textbox', { name: 'Logged by' }), 'Jane Smith');
    await userEvent.click(canvas.getByRole('button', { name: 'Save action' }));
    const saving = await canvas.findByRole('button', { name: 'Saving…' });
    await expect(saving).toHaveAttribute('aria-disabled', 'true');
    await expect(saving).toHaveFocus();
  },
});

/** After a save: "Action saved", status and note cleared, "Logged by" kept, focus on Save. */
export const Saved = meta.story({
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Marketing Promotion' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Note (optional)' }), 'Weekend email');
    await userEvent.type(canvas.getByRole('textbox', { name: 'Logged by' }), 'Jane Smith');
    await userEvent.click(canvas.getByRole('button', { name: 'Save action' }));
    await expect(await canvas.findByRole('status')).toHaveTextContent('Action saved');
    await expect(args.onSubmit).toHaveBeenCalledOnce();
    await expect(canvas.getByRole('radio', { name: 'Marketing Promotion' })).not.toBeChecked();
    await expect(canvas.getByRole('textbox', { name: 'Note (optional)' })).toHaveValue('');
    await expect(canvas.getByRole('textbox', { name: 'Logged by' })).toHaveValue('Jane Smith');
    await expect(canvas.getByRole('button', { name: 'Save action' })).toHaveFocus();
  },
});

/** A failed save keeps the input, shows the mapped message and focuses it (AC-006.7). */
export const SaveError = meta.story({
  args: { onSubmit: fn(() => Promise.reject(new TypeError('Failed to fetch'))) },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Under Review' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Logged by' }), 'Jane Smith');
    await userEvent.click(canvas.getByRole('button', { name: 'Save action' }));
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent("Couldn't save the action");
    await expect(alert).toHaveFocus();
    await expect(canvas.getByRole('textbox', { name: 'Logged by' })).toHaveValue('Jane Smith');
  },
});
