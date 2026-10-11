import { render, screen, within } from '@testing-library/react';
import { ActionHistory } from './ActionHistory';
import { i18n } from '@/i18n';
import { buildActionEntry } from '@/mocks/fixtures';

/** AC-007.4: 11:00 "Marketing Promotion" before 09:00 "Under Review" (API order, newest first). */
const twoEntries = [
  buildActionEntry({
    id: 2,
    status: 'Marketing Promotion',
    note: 'Weekend email',
    loggedBy: 'Sam Patel',
    loggedAt: '2026-10-07T11:00:00.000Z',
  }),
  buildActionEntry({ id: 1, status: 'Under Review', loggedAt: '2026-10-07T09:00:00.000Z' }),
];

const items = (name = 'Action history, newest first') =>
  within(screen.getByRole('list', { name })).getAllByRole('listitem');

describe('ActionHistory (US-007)', () => {
  it('lists entries newest first with status, dealership-local time, name and note (AC-007.4, TA-12)', () => {
    render(<ActionHistory actions={twoEntries} timeZone="Europe/London" />);

    const [first, second] = items();
    expect(first).toHaveTextContent('Marketing Promotion');
    expect(first).toHaveTextContent('07 Oct 2026, 12:00'); // 11:00 UTC is 12:00 BST
    expect(first).toHaveTextContent('Logged by Sam Patel');
    expect(first).toHaveTextContent('Weekend email');
    expect(second).toHaveTextContent('Under Review');
    expect(second).toHaveTextContent('07 Oct 2026, 10:00');
    expect(within(first ?? document.body).getByText('07 Oct 2026, 12:00')).toHaveAttribute(
      'datetime',
      '2026-10-07T11:00:00.000Z',
    );
  });

  it('renders markup in a note as literal text (AC-006.8)', () => {
    const { container } = render(
      <ActionHistory
        actions={[buildActionEntry({ note: '<b>cut</b>', loggedBy: '<i>Jo</i>' })]}
        timeZone="Europe/London"
      />,
    );

    expect(screen.getByText('<b>cut</b>')).toBeVisible();
    expect(screen.getByText('Logged by <i>Jo</i>')).toBeVisible();
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- asserting no element was created from the markup
    expect(container.querySelector('b, i')).toBeNull();
  });

  it('offers no way to edit or delete an entry (AC-007.6, BR-13)', () => {
    render(<ActionHistory actions={twoEntries} timeZone="Europe/London" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('says so when nothing has been logged (AC-007.5)', () => {
    render(<ActionHistory actions={[]} timeZone="Europe/London" />);

    expect(screen.getByText('No actions have been logged for this vehicle yet.')).toBeVisible();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('translates labels and formats in Vietnamese, but never the data (AC-015.4, AC-015.5)', async () => {
    await i18n.changeLanguage('vi');
    render(<ActionHistory actions={twoEntries} timeZone="Europe/London" />);

    expect(screen.getByRole('heading', { name: 'Lịch sử hành động' })).toBeVisible();
    const [first, second] = items('Lịch sử hành động, mới nhất trước');
    expect(first).toHaveTextContent('Chạy khuyến mãi');
    expect(first).toHaveTextContent('07/10/2026 12:00');
    expect(first).toHaveTextContent('Người ghi nhận: Sam Patel');
    expect(first).toHaveTextContent('Weekend email');
    expect(second).toHaveTextContent('Đang xem xét');
  });
});
