import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Pagination } from '@/features/inventory';
import { i18n } from '@/i18n';

describe('Pagination', () => {
  it('summarises the visible range inside a labelled nav, without a live region', () => {
    render(<Pagination page={2} pageSize={25} total={312} onPageChange={vi.fn()} />);

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav).toHaveTextContent('Showing 26-50 of 312');
    // The filter bar's match count announces result changes; this text is read on demand.
    expect(within(nav).getByText('Showing 26-50 of 312')).not.toHaveAttribute('aria-live');
    expect(within(nav).queryByRole('status')).not.toBeInTheDocument();
    expect(nav).toHaveTextContent('Page 2 of 13');
  });

  it('formats large totals with thousands separators', () => {
    render(<Pagination page={1} pageSize={25} total={1200} onPageChange={vi.fn()} />);

    expect(screen.getByText('Showing 1-25 of 1,200')).toBeVisible();
  });

  it('moves to the previous and next page (AC-001.4)', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageSize={25} total={60} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));

    expect(onPageChange.mock.calls).toEqual([[3], [1]]);
  });

  it('marks Previous as disabled on the first page and Next on the last page', async () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <Pagination page={1} pageSize={25} total={30} onPageChange={onPageChange} />,
    );
    const previous = screen.getByRole('button', { name: 'Previous page' });
    expect(previous).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Next page' })).not.toHaveAttribute('aria-disabled');
    await userEvent.click(previous);
    expect(onPageChange).not.toHaveBeenCalled();

    rerender(<Pagination page={2} pageSize={25} total={30} onPageChange={onPageChange} />);
    expect(screen.getByText('Showing 26-30 of 30')).toBeVisible();
    const next = screen.getByRole('button', { name: 'Next page' });
    expect(screen.getByRole('button', { name: 'Previous page' })).not.toHaveAttribute(
      'aria-disabled',
    );
    expect(next).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(next);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('keeps focus on Next after moving onto the last page', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [page, setPage] = useState(1);
      return <Pagination page={page} pageSize={25} total={30} onPageChange={setPage} />;
    }
    render(<Harness />);

    const next = screen.getByRole('button', { name: 'Next page' });
    await user.click(next);

    expect(screen.getByText('Page 2 of 2')).toBeVisible();
    expect(next).toHaveAttribute('aria-disabled', 'true');
    expect(next).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByText('Page 2 of 2')).toBeVisible();
  });

  it('uses Vietnamese text and number grouping when Vietnamese is selected (AC-015.2)', async () => {
    await i18n.changeLanguage('vi');
    render(<Pagination page={2} pageSize={25} total={1200} onPageChange={vi.fn()} />);

    const nav = screen.getByRole('navigation', { name: 'Phân trang' });
    expect(within(nav).getByText('Hiển thị 26-50 / 1.200')).toBeVisible();
    expect(nav).toHaveTextContent('Trang 2 / 48');
    expect(screen.getByRole('button', { name: 'Trang trước' })).toHaveTextContent('Trước');
    expect(screen.getByRole('button', { name: 'Trang sau' })).toHaveTextContent('Sau');
  });
});
