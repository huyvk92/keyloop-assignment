import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { useFormatters } from '@/lib/use-formatters';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

/**
 * `aria-disabled` instead of native `disabled`: a natively disabled button drops focus to <body>
 * when Next reaches the last page; this keeps focus and is still announced as unavailable.
 */
const unavailable = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

/** Previous/next paging with a live "Showing 26-50 of 312" summary (AC-001.4, TRD section 6). */
export function Pagination({ page, pageSize, total, onPageChange }: Props) {
  const { t } = useTranslation();
  const { integer } = useFormatters();
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const isFirst = page <= 1;
  const isLast = page >= lastPage;

  return (
    <nav
      aria-label={t('inventory.pagination.label')}
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700"
    >
      <p aria-live="polite">
        {t('inventory.pagination.summary', {
          from: integer(from),
          to: integer(to),
          total: integer(total),
        })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label={t('inventory.pagination.previousLabel')}
          aria-disabled={isFirst || undefined}
          className={unavailable}
          onClick={() => {
            if (!isFirst) onPageChange(page - 1);
          }}
        >
          {t('inventory.pagination.previous')}
        </Button>
        <span>
          {t('inventory.pagination.page', { page: integer(page), lastPage: integer(lastPage) })}
        </span>
        <Button
          variant="secondary"
          size="sm"
          aria-label={t('inventory.pagination.nextLabel')}
          aria-disabled={isLast || undefined}
          className={unavailable}
          onClick={() => {
            if (!isLast) onPageChange(page + 1);
          }}
        >
          {t('inventory.pagination.next')}
        </Button>
      </div>
    </nav>
  );
}
