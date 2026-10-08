import preview from '#.storybook/preview';
import { useState, type ComponentProps } from 'react';
import { expect, fn, waitFor } from 'storybook/test';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';

type DemoProps = Omit<ComponentProps<typeof Dialog>, 'open'>;

/** Trigger + controlled Dialog, so stories exercise opening, closing and focus return. */
function DialogDemo({ onClose, ...props }: DemoProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>View STK-1042</Button>
      <Dialog
        {...props}
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      />
    </>
  );
}

/** 30 history entries, newest first: enough to overflow and scroll inside the dialog body. */
const history = Array.from({ length: 30 }, (_, index) => {
  const day = String(30 - index).padStart(2, '0');
  return { id: `entry-${day}`, text: `2026-09-${day} · Price Reduction Planned · Jane Smith` };
});

const meta = preview.meta({
  title: 'Components/Dialog',
  component: DialogDemo,
  parameters: { layout: 'padded' },
  args: {
    onClose: fn(),
    title: 'STK-1042 · Ford Focus',
    description: 'Vehicle details and action history',
    children: <p>In stock for 120 days.</p>,
    footer: <Button variant="secondary">Log action</Button>,
  },
});

// Stories start closed. From md the dialog is a full-height drawer on the right (ADR-006);
// the Mobile story shows the bottom sheet used below md. (play doesn't run on the autodocs page, so it never stacks modals) and
// open in the canvas via play, so the a11y addon checks the open dialog.
export const Default = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'View STK-1042' }));
    await expect(await canvas.findByRole('dialog')).toHaveAttribute('open');
  },
});

export const LongContent = meta.story({
  args: {
    children: (
      <ol className="space-y-2">
        {history.map((entry) => (
          <li key={entry.id} className="rounded-md border border-slate-200 p-3 text-sm">
            {entry.text}
          </li>
        ))}
      </ol>
    ),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'View STK-1042' }));
    await expect(await canvas.findByRole('dialog')).toHaveAttribute('open');
  },
});

/** Keyboard only: Enter opens, focus lands on the heading, Escape closes, focus returns. */
export const KeyboardOpenClose = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'View STK-1042' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');

    const dialog = await canvas.findByRole('dialog', { name: 'STK-1042 · Ford Focus' });
    await expect(dialog).toHaveAttribute('open');
    await expect(canvas.getByRole('heading', { name: 'STK-1042 · Ford Focus' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(args.onClose).toHaveBeenCalledOnce();
    await expect(trigger).toHaveFocus();
  },
});

/** Below `md`: a full-width bottom sheet instead of the right-side drawer. */
export const Mobile = meta.story({
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'View STK-1042' }));
    await expect(await canvas.findByRole('dialog')).toHaveAttribute('open');
  },
});
