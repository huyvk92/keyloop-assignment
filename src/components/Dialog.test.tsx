import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { i18n } from '@/i18n';

/**
 * jsdom has no `showModal`/`close` and no Escape-to-cancel; `src/test/setup.ts` adds a minimal
 * stub (ADR-006). Inert background, top layer and real focus behaviour are checked in Storybook
 * and the manual keyboard pass (T-038).
 */

type HarnessProps = {
  onClose?: () => void;
  /** Unmount the trigger while the dialog is open (e.g. its table row disappeared). */
  hideTriggerWhileOpen?: boolean;
  description?: string;
  /** Adds a focusable "Vehicle list" region and returns it as the focus fallback. */
  withFallback?: boolean;
};

function Harness({
  onClose,
  hideTriggerWhileOpen = false,
  description,
  withFallback = false,
}: HarnessProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {withFallback && (
        <div id="fallback-region" role="region" aria-label="Vehicle list" tabIndex={-1} />
      )}
      {!(hideTriggerWhileOpen && open) && (
        <button type="button" onClick={() => setOpen(true)}>
          View STK-1042
        </button>
      )}
      <Dialog
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="STK-1042 Ford Focus"
        description={description}
        returnFocusFallback={
          withFallback ? () => document.getElementById('fallback-region') : undefined
        }
        footer={<button type="button">Save</button>}
      >
        <label>
          Note
          <input />
        </label>
      </Dialog>
    </>
  );
}

async function openDialog(props: HarnessProps = {}) {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<Harness onClose={onClose} {...props} />);
  await user.click(screen.getByRole('button', { name: 'View STK-1042' }));
  return { user, onClose, dialog: screen.getByRole('dialog', { name: 'STK-1042 Ford Focus' }) };
}

describe('Dialog (ADR-006, AC-004.4, NFR-01)', () => {
  it('is not in the accessibility tree while closed', () => {
    render(<Harness />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as a modal named by its title, with optional description and footer', async () => {
    const { dialog } = await openDialog({ description: 'Vehicle details and action history' });

    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleDescription('Vehicle details and action history');
    expect(screen.getByRole('heading', { name: 'STK-1042 Ford Focus' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('has no accessible description when none is given', async () => {
    const { dialog } = await openDialog();

    expect(dialog).not.toHaveAttribute('aria-describedby');
  });

  it('moves focus to the heading on open, not the first input', async () => {
    await openDialog();

    expect(screen.getByRole('heading', { name: 'STK-1042 Ford Focus' })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Note' })).not.toHaveFocus();
  });

  it('closes with the Close button and returns focus to the trigger', async () => {
    const { user, onClose } = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View STK-1042' })).toHaveFocus();
  });

  it('closes with Escape and returns focus to the trigger', async () => {
    const { user, onClose } = await openDialog();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View STK-1042' })).toHaveFocus();
  });

  it('stays controlled: Escape only asks the parent, which decides whether to close', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Unsaved changes">
        <p>Body</p>
      </Dialog>,
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'Unsaved changes' })).toHaveAttribute('open');
  });

  it('closes on a backdrop click (the dialog element itself)', async () => {
    const { user, onClose, dialog } = await openDialog();

    await user.click(dialog);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('stays open when clicking inside the content', async () => {
    const { user, onClose } = await openDialog();

    await user.click(screen.getByRole('textbox', { name: 'Note' }));
    await user.click(screen.getByRole('heading', { name: 'STK-1042 Ford Focus' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not close when a press starts inside the content and ends on the backdrop', async () => {
    const { user, onClose, dialog } = await openDialog();

    await user.pointer([
      { keys: '[MouseLeft>]', target: screen.getByRole('textbox', { name: 'Note' }) },
      { target: dialog },
      { keys: '[/MouseLeft]', target: dialog },
    ]);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('prevents background scroll while open and restores it on close', async () => {
    const { user } = await openDialog();

    expect(document.body).toHaveClass('overflow-hidden');

    await user.keyboard('{Escape}');

    expect(document.body).not.toHaveClass('overflow-hidden');
  });

  it('falls back to the body without throwing when the trigger is gone', async () => {
    const { user } = await openDialog({ hideTriggerWhileOpen: true });

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });

  it('moves focus to returnFocusFallback when the trigger is gone (ADR-006)', async () => {
    const { user } = await openDialog({ hideTriggerWhileOpen: true, withFallback: true });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Vehicle list' })).toHaveFocus();
  });

  it('still prefers the trigger over the fallback when the trigger exists', async () => {
    const { user } = await openDialog({ withFallback: true });

    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'View STK-1042' })).toHaveFocus();
  });

  it('syncs the parent once when the browser closes the dialog without a cancel event', async () => {
    const { onClose, dialog } = await openDialog();
    if (!(dialog instanceof HTMLDialogElement)) throw new Error('expected a <dialog>');

    // e.g. Chrome's close watcher after repeated Escape: `close` fires, `cancel` doesn't.
    act(() => dialog.close());

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View STK-1042' })).toHaveFocus();
  });

  it('labels the Close button in Vietnamese', async () => {
    await i18n.changeLanguage('vi');
    await openDialog();

    expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
  });
});
