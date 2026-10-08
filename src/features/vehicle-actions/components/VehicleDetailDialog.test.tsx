import { act, screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { useState } from 'react';
import { VehicleDetailDialog } from './VehicleDetailDialog';
import { i18n } from '@/i18n';
import { apiUrl } from '@/lib/http';
import { FIXTURE_HISTORY_VEHICLES } from '@/mocks/fixtures';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test/render';

const detailUrl = apiUrl('/vehicles/:vehicleId');
const actionsUrl = apiUrl('/vehicles/:vehicleId/actions');

/** A trigger plus the dialog, as DashboardPage wires them (local state, TA-16). */
function Harness({ vehicleId }: { vehicleId: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <>
      <button type="button" onClick={() => setSelected(vehicleId)}>
        Open vehicle
      </button>
      <VehicleDetailDialog vehicleId={selected} onClose={() => setSelected(null)} />
    </>
  );
}

async function openVehicle(vehicleId: number) {
  const view = renderWithProviders(<Harness vehicleId={vehicleId} />);
  await view.user.click(screen.getByRole('button', { name: 'Open vehicle' }));
  return view;
}

const historyItems = (dialog: HTMLElement) =>
  within(within(dialog).getByRole('list', { name: 'Action history, newest first' })).getAllByRole(
    'listitem',
  );

/** The first fact is the current action (`<dd>` has the "definition" role). */
const currentAction = (dialog: HTMLElement) => within(dialog).getAllByRole('definition')[0];

describe('VehicleDetailDialog (T-030)', () => {
  it('shows the facts, the current action and the history newest first (AC-004.4, AC-007.4)', async () => {
    await openVehicle(FIXTURE_HISTORY_VEHICLES.twoEntries);

    const dialog = await screen.findByRole('dialog', { name: 'STK-1001 · Toyota Corolla' });
    expect(within(dialog).getByText('£15,250')).toBeVisible();
    expect(within(dialog).getByText('200 days')).toBeVisible();
    expect(within(dialog).getByText('Aging')).toBeVisible();
    const [first, second] = historyItems(dialog);
    expect(first).toHaveTextContent('Marketing Promotion');
    expect(first).toHaveTextContent('07 Oct 2026, 12:00');
    expect(first).toHaveTextContent('Logged by Sam Patel');
    expect(second).toHaveTextContent('Under Review');
    // Current action = the latest entry (BR-14).
    expect(currentAction(dialog)).toHaveTextContent(
      'Marketing PromotionSam Patel · 07 Oct 2026, 12:00',
    );
  });

  it('shows the "Log action" form for an aging vehicle (AC-006.1)', async () => {
    await openVehicle(FIXTURE_HISTORY_VEHICLES.twoEntries);

    const dialog = await screen.findByRole('dialog', { name: /STK-1001/ });
    expect(within(dialog).getByRole('heading', { name: 'Log action' })).toBeVisible();
    expect(within(dialog).getAllByRole('radio')).toHaveLength(5);
  });

  it('renders a markup note as literal text and offers no edit or delete (AC-006.8, AC-007.6)', async () => {
    await openVehicle(FIXTURE_HISTORY_VEHICLES.markupNote);

    const dialog = await screen.findByRole('dialog', { name: /STK-1004/ });
    const [entry] = historyItems(dialog);
    expect(within(entry ?? dialog).getByText('<b>cut</b>')).toBeVisible();
    expect(within(entry ?? dialog).queryByRole('button')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /edit|delete/i })).not.toBeInTheDocument();
  });

  it('has no form for a non-aging vehicle but still shows its history (AC-006.2, BR-09)', async () => {
    await openVehicle(FIXTURE_HISTORY_VEHICLES.nonAging);

    const dialog = await screen.findByRole('dialog', { name: /STK-1201/ });
    expect(within(dialog).getByText('45 days')).toBeVisible();
    expect(
      within(dialog).getByText(/Actions can only be logged for vehicles in stock for more than 90/),
    ).toBeVisible();
    expect(within(dialog).queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Save action' })).not.toBeInTheDocument();
    expect(historyItems(dialog)[0]).toHaveTextContent('Checked on arrival');
  });

  it('shows "No action" and an empty history for a vehicle without actions (AC-007.5)', async () => {
    await openVehicle(2);

    const dialog = await screen.findByRole('dialog', { name: /STK-1002/ });
    expect(within(dialog).getByText('No action')).toBeVisible();
    expect(
      within(dialog).getByText('No actions have been logged for this vehicle yet.'),
    ).toBeVisible();
  });

  it('shows a loading state with a fallback title while the vehicle loads', async () => {
    server.use(http.get(detailUrl, () => delay('infinite')));
    await openVehicle(1);

    const dialog = screen.getByRole('dialog', { name: 'Vehicle details' });
    expect(within(dialog).getByRole('status')).toHaveTextContent('Loading vehicle details…');
  });

  it('shows an error with Retry, which loads the vehicle (AC-001.6)', async () => {
    server.use(http.get(detailUrl, () => HttpResponse.json(null, { status: 503 }), { once: true }));
    const { user } = await openVehicle(1);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load this vehicle");
    expect(alert).toHaveTextContent('The server ran into a problem. Try again in a moment.');

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('dialog', { name: /STK-1001/ })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('maps a 404 to the not-found message', async () => {
    await openVehicle(9999);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't find what you were looking for.",
    );
  });

  it('closes with Escape and returns focus to the trigger (ADR-006)', async () => {
    const { user } = await openVehicle(1);
    await screen.findByRole('dialog', { name: /STK-1001/ });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open vehicle' })).toHaveFocus();
  });

  it('keeps typed input when the vehicle is refetched (polling, TRD risk)', async () => {
    let detailRequests = 0;
    server.use(
      http.get(detailUrl, () => {
        detailRequests += 1;
      }),
    );
    const { user, queryClient } = await openVehicle(1);
    const dialog = await screen.findByRole('dialog', { name: /STK-1001/ });
    await user.click(within(dialog).getByRole('radio', { name: 'Under Review' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Note (optional)' }), 'Half typed');
    await user.type(within(dialog).getByRole('textbox', { name: 'Logged by' }), 'Jane');

    await act(() => queryClient.refetchQueries());

    expect(detailRequests).toBe(2);
    expect(within(dialog).getByRole('radio', { name: 'Under Review' })).toBeChecked();
    expect(within(dialog).getByRole('textbox', { name: 'Note (optional)' })).toHaveValue(
      'Half typed',
    );
    expect(within(dialog).getByRole('textbox', { name: 'Logged by' })).toHaveValue('Jane');
  });

  it('keeps the last details and the typed input, with a hint, when a background refresh fails', async () => {
    const { user, queryClient } = await openVehicle(1);
    const dialog = await screen.findByRole('dialog', { name: 'STK-1001 · Toyota Corolla' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Logged by' }), 'Jane');
    expect(within(dialog).queryByText(/Couldn't refresh this vehicle/)).not.toBeInTheDocument();
    server.use(http.get(detailUrl, () => HttpResponse.json(null, { status: 503 })));

    await act(() => queryClient.refetchQueries());

    expect(
      await within(dialog).findByText(
        "Couldn't refresh this vehicle. Showing the last loaded details.",
      ),
    ).toBeVisible();
    // Not an error state: no alert, the facts and the form stay.
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(dialog).getByText('200 days')).toBeVisible();
    expect(within(dialog).getByRole('textbox', { name: 'Logged by' })).toHaveValue('Jane');
  });

  it('renders the vehicle in Vietnamese, data unchanged (AC-015.4, AC-015.5)', async () => {
    await i18n.changeLanguage('vi');
    await openVehicle(FIXTURE_HISTORY_VEHICLES.twoEntries);

    const dialog = await screen.findByRole('dialog', { name: 'STK-1001 · Toyota Corolla' });
    expect(within(dialog).getByText('200 ngày')).toBeVisible();
    const list = within(dialog).getByRole('list', { name: 'Lịch sử hành động, mới nhất trước' });
    const [first] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent('Chạy khuyến mãi');
    expect(first).toHaveTextContent('07/10/2026 12:00');
    expect(first).toHaveTextContent('Feature in the weekend email campaign');
    expect(within(dialog).getByRole('radiogroup', { name: 'Trạng thái hành động' })).toBeVisible();
  });
});

describe('Logging an action from the dialog (T-032)', () => {
  /** Opens a vehicle and fills the form; queries stay inside this test's dialog. */
  async function openAndFill(
    vehicleId = 2,
    labels = { status: 'Price Reduction Planned', note: 'Note (optional)', loggedBy: 'Logged by' },
  ) {
    const view = await openVehicle(vehicleId);
    const dialog = await screen.findByRole('dialog', {
      name: new RegExp(`STK-${1000 + vehicleId}`),
    });
    const { user } = view;
    await user.click(within(dialog).getByRole('radio', { name: labels.status }));
    await user.click(within(dialog).getByRole('textbox', { name: labels.note }));
    await user.paste('  Reduce by 5%  ');
    await user.click(within(dialog).getByRole('textbox', { name: labels.loggedBy }));
    await user.paste('  Jane Smith ');
    return { ...view, dialog };
  }

  async function fillAndSave(vehicleId = 2) {
    const view = await openAndFill(vehicleId);
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Save action' }));
    return view;
  }

  /** AC-006.7: a failed save leaves all three inputs as typed. */
  function expectInputsKept(dialog: HTMLElement) {
    expect(within(dialog).getByRole('radio', { name: 'Price Reduction Planned' })).toBeChecked();
    expect(within(dialog).getByRole('textbox', { name: 'Note (optional)' })).toHaveValue(
      '  Reduce by 5%  ',
    );
    expect(within(dialog).getByRole('textbox', { name: 'Logged by' })).toHaveValue('  Jane Smith ');
  }

  it('confirms, puts the entry at the top of the history and updates the current action (AC-006.3)', async () => {
    const { dialog } = await fillAndSave();

    expect(await within(dialog).findByRole('status')).toHaveTextContent('Action saved');
    const [first] = historyItems(dialog);
    expect(first).toHaveTextContent('Price Reduction Planned');
    expect(first).toHaveTextContent('Reduce by 5%');
    expect(first).toHaveTextContent('Logged by Jane Smith');
    expect(first).toHaveTextContent('07 Oct 2026, 13:00'); // MOCK_NOW 12:00 UTC, BST
    expect(currentAction(dialog)).toHaveTextContent('Price Reduction Planned');
    // Status and note cleared; the name stays for the next entry.
    expect(
      within(dialog).getByRole('radio', { name: 'Price Reduction Planned' }),
    ).not.toBeChecked();
    expect(within(dialog).getByRole('textbox', { name: 'Note (optional)' })).toHaveValue('');
    expect(within(dialog).getByRole('textbox', { name: 'Logged by' })).toHaveValue('  Jane Smith ');
  });

  it('keeps every input after a 503 and succeeds on retry (AC-006.7)', async () => {
    server.use(
      http.post(actionsUrl, () => HttpResponse.json(null, { status: 503 }), { once: true }),
    );
    const { dialog, user } = await fillAndSave();

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't save the action");
    expect(alert).toHaveTextContent('The server ran into a problem. Try again in a moment.');
    expectInputsKept(dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Save action' }));

    expect(await within(dialog).findByText('Action saved')).toBeVisible();
    expect(historyItems(dialog)[0]).toHaveTextContent('Reduce by 5%');
  });

  it('shows the mapped message for a 422 VEHICLE_NOT_AGING and keeps every input (AC-006.7)', async () => {
    server.use(
      http.post(actionsUrl, () =>
        HttpResponse.json(
          { error: { code: 'VEHICLE_NOT_AGING', message: 'raw server text' } },
          { status: 422 },
        ),
      ),
    );
    const { dialog } = await fillAndSave();

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(
      'Actions can only be logged for vehicles in stock for more than 90 days.',
    );
    expect(alert).not.toHaveTextContent('raw server text');
    expectInputsKept(dialog);
  });

  it('shows the network message and keeps every input when the request never reaches the server (AC-006.7)', async () => {
    server.use(http.post(actionsUrl, () => HttpResponse.error()));
    const { dialog } = await fillAndSave();

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Couldn't reach the server. Check your connection and try again.",
    );
    expectInputsKept(dialog);
  });

  it('posts once even when Save is activated again while saving', async () => {
    let posts = 0;
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(actionsUrl, async () => {
        posts += 1;
        await held; // keep the save in flight until the extra attempts are done
      }),
    );
    const { dialog, user } = await fillAndSave();

    const saving = await within(dialog).findByRole('button', { name: 'Saving…' });
    expect(saving).toHaveAttribute('aria-disabled', 'true');
    await user.click(saving);
    await user.keyboard('{Enter}');
    await user.type(within(dialog).getByRole('textbox', { name: 'Logged by' }), '{Enter}');
    release();

    expect(await within(dialog).findByText('Action saved')).toBeVisible();
    expect(posts).toBe(1);
  });

  it('posts the canonical, trimmed body in Vietnamese and shows the Vietnamese confirmation (BR-19)', async () => {
    await i18n.changeLanguage('vi');
    const bodies: unknown[] = [];
    server.use(
      http.post(actionsUrl, async ({ request }) => {
        bodies.push(await request.clone().json());
        // No response: the default handler stores and answers.
      }),
    );
    const { dialog, user } = await openAndFill(2, {
      status: 'Dự kiến giảm giá',
      note: 'Ghi chú (không bắt buộc)',
      loggedBy: 'Người ghi nhận',
    });

    await user.click(within(dialog).getByRole('button', { name: 'Lưu hành động' }));

    expect(await within(dialog).findByRole('status')).toHaveTextContent('Đã lưu hành động');
    expect(bodies).toEqual([
      { status: 'Price Reduction Planned', note: 'Reduce by 5%', loggedBy: 'Jane Smith' },
    ]);
  });

  it.each([
    {
      name: '503',
      response: () => HttpResponse.json(null, { status: 503 }),
      message: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau giây lát.',
    },
    {
      name: '422 VEHICLE_NOT_AGING',
      response: () =>
        HttpResponse.json(
          { error: { code: 'VEHICLE_NOT_AGING', message: 'raw server text' } },
          { status: 422 },
        ),
      message: 'Chỉ có thể ghi nhận hành động cho xe tồn kho trên 90 ngày.',
    },
  ])('shows the $name save error in Vietnamese (BR-19)', async ({ response, message }) => {
    await i18n.changeLanguage('vi');
    server.use(http.post(actionsUrl, response));
    const { dialog, user } = await openAndFill(2, {
      status: 'Dự kiến giảm giá',
      note: 'Ghi chú (không bắt buộc)',
      loggedBy: 'Người ghi nhận',
    });

    await user.click(within(dialog).getByRole('button', { name: 'Lưu hành động' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Không thể lưu hành động');
    expect(alert).toHaveTextContent(message);
    expect(alert).not.toHaveTextContent('raw server text');
  });
});
