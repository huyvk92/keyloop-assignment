import preview from '#.storybook/preview';
import { delay, http, HttpResponse } from 'msw';
import { useState } from 'react';
import { expect, fn, within } from 'storybook/test';
import { Button } from '@/components/Button';
import { apiUrl } from '@/lib/http';
import { resetMockActionStore } from '@/mocks/action-store';
import { FIXTURE_HISTORY_VEHICLES } from '@/mocks/fixtures';
import { VehicleDetailDialog } from './VehicleDetailDialog';

type DemoProps = { vehicleId: number; onClose: () => void };

/** A "View" trigger plus the drawer, so stories exercise opening, closing and focus return. */
function VehicleDrawerDemo({ vehicleId, onClose }: DemoProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>View vehicle</Button>
      <VehicleDetailDialog
        vehicleId={open ? vehicleId : null}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      />
    </>
  );
}

const detailUrl = apiUrl('/vehicles/:vehicleId');
const actionsUrl = apiUrl('/vehicles/:vehicleId/actions');

const meta = preview.meta({
  title: 'Vehicle actions/VehicleDetailDialog',
  component: VehicleDrawerDemo,
  parameters: { layout: 'padded' },
  // Default MSW data: vehicle 1 is aging (200 days) with two history entries (AC-007.4).
  args: { vehicleId: FIXTURE_HISTORY_VEHICLES.twoEntries, onClose: fn() },
});

// Stories start closed (play doesn't run on the autodocs page, so modals never stack) and open in
// the canvas via play, so the a11y addon checks the open drawer.

/** Aging vehicle: facts, current action, "Log action" form and history newest first. */
export const Aging = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'View vehicle' }));
    const dialog = await canvas.findByRole('dialog', { name: 'STK-1001 · Toyota Corolla' });
    await expect(dialog).toHaveAttribute('open');
    await expect(await canvas.findByRole('radiogroup', { name: 'Action status' })).toBeVisible();
  },
});

/** 45 days: no form, a short explanation, and the history stays visible (AC-006.2). */
export const NonAging = meta.story({
  args: { vehicleId: FIXTURE_HISTORY_VEHICLES.nonAging },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'View vehicle' }));
    await expect(await canvas.findByText('Checked on arrival')).toBeVisible();
    await expect(canvas.queryByRole('radiogroup')).not.toBeInTheDocument();
  },
});

/** A note with markup is shown as text (AC-006.8). */
export const MarkupNote = meta.story({
  args: { vehicleId: FIXTURE_HISTORY_VEHICLES.markupNote },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'View vehicle' }));
    await expect(await canvas.findByText('<b>cut</b>')).toBeVisible();
  },
});

/** Saving with nothing filled in: field errors, nothing sent (AC-006.4). */
export const ValidationError = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'View vehicle' }));
    const save = await canvas.findByRole('button', { name: 'Save action' });
    await userEvent.click(save);
    await expect(await canvas.findByText('Select an action status.')).toBeVisible();
    await expect(canvas.getByText('Enter your name.')).toBeVisible();
    await expect(canvas.getByRole('radio', { name: 'Price Reduction Planned' })).toHaveFocus();
  },
});

/** A valid save: "Action saved", and the new entry heads the history (AC-006.3, BR-13). */
export const SaveSuccess = meta.story({
  // The mock store is shared by the stories: start each run from the fixtures.
  beforeEach() {
    resetMockActionStore();
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'View vehicle' }));
    await userEvent.click(await canvas.findByRole('radio', { name: 'Price Reduction Planned' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Note (optional)' }), 'Reduce by 5%');
    // Cleared first: a name remembered by an earlier save in this browser is pre-filled (US-012).
    await userEvent.clear(canvas.getByRole('textbox', { name: 'Logged by' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Logged by' }), 'Jane Smith');
    await userEvent.click(canvas.getByRole('button', { name: 'Save action' }));
    await expect(await canvas.findByText('Action saved')).toBeVisible();
    const history = await canvas.findByRole('list', { name: 'Action history, newest first' });
    await expect(await within(history).findByText('Reduce by 5%')).toBeVisible();
  },
});

/** The save fails (503): a mapped alert takes focus, every input is kept for a retry (AC-006.7). */
export const SaveError = meta.story({
  beforeEach({ msw }) {
    msw.use(http.post(actionsUrl, () => HttpResponse.json(null, { status: 503 })));
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'View vehicle' }));
    await userEvent.click(await canvas.findByRole('radio', { name: 'Under Review' }));
    // Cleared first: a name remembered by an earlier save in this browser is pre-filled (US-012).
    await userEvent.clear(canvas.getByRole('textbox', { name: 'Logged by' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Logged by' }), 'Jane Smith');
    await userEvent.click(canvas.getByRole('button', { name: 'Save action' }));
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent("Couldn't save the action");
    await expect(alert).toHaveFocus();
    await expect(canvas.getByRole('radio', { name: 'Under Review' })).toBeChecked();
    await expect(canvas.getByRole('textbox', { name: 'Logged by' })).toHaveValue('Jane Smith');
  },
});

export const Loading = meta.story({
  beforeEach({ msw }) {
    msw.use(http.get(detailUrl, () => delay('infinite')));
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'View vehicle' }));
    await expect(await canvas.findByRole('dialog', { name: 'Vehicle details' })).toBeVisible();
  },
});

export const LoadError = meta.story({
  beforeEach({ msw }) {
    msw.use(http.get(detailUrl, () => HttpResponse.json(null, { status: 503 })));
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'View vehicle' }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent("Couldn't load this vehicle");
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible();
  },
});
