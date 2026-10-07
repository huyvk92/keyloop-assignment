import { Button } from '@/components/Button';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

const count = new Intl.NumberFormat('en-GB');

/**
 * `aria-disabled` instead of native `disabled`: a natively disabled button drops focus to <body>
 * when Next reaches the last page; this keeps focus and is still announced as unavailable.
 */
const unavailable = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

/** Previous/next paging with a live "Showing 26-50 of 312" summary (AC-001.4, TRD section 6). */
export function Pagination({ page, pageSize, total, onPageChange }: Props) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const isFirst = page <= 1;
  const isLast = page >= lastPage;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700"
    >
      <p aria-live="polite">
        {`Showing ${count.format(from)}-${count.format(to)} of ${count.format(total)}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label="Previous page"
          aria-disabled={isFirst || undefined}
          className={unavailable}
          onClick={() => {
            if (!isFirst) onPageChange(page - 1);
          }}
        >
          Previous
        </Button>
        <span>{`Page ${count.format(page)} of ${count.format(lastPage)}`}</span>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Next page"
          aria-disabled={isLast || undefined}
          className={unavailable}
          onClick={() => {
            if (!isLast) onPageChange(page + 1);
          }}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
