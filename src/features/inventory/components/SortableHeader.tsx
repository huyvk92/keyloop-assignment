import type { SortKey, SortOrder } from '@shared/api/vehicles';
import { useId } from 'react';
import { cn } from '@/lib/cn';

type Props = {
  /** Visible header text; also the button's accessible name. */
  label: string;
  sortKey: SortKey;
  /** The list's current sort and its effective order. */
  sort: SortKey;
  order: SortOrder;
  onSort: (key: SortKey) => void;
  /**
   * What the button sorts by, when the label alone doesn't say it (Make sorts by make, then
   * model, AC-011.2). Its accessible description, so the name (and the column header's name, read
   * for every cell) stays the visible label.
   */
  hint?: string;
  className?: string;
};

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const satisfies Record<
  SortOrder,
  string
>;

/** Up, down, or both (faint) when the column isn't the active sort. Decorative only. */
function SortIcon({ state }: { state: SortOrder | 'none' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      fill="currentColor"
      className={cn('size-3 shrink-0', state === 'none' && 'text-slate-500')}
    >
      {state !== 'desc' && <path d="M6 1.5 9 5H3z" />}
      {state !== 'asc' && <path d="M6 10.5 3 7h6z" />}
    </svg>
  );
}

/**
 * A sortable column header (US-011): a `<button>` inside the `<th>`, with `aria-sort` on the `<th>`
 * of the active column only (TRD section 6). The button is named by the visible label; the sort
 * state comes from `aria-sort`, and the change itself is announced by the table (AC-011.3).
 */
export function SortableHeader({ label, sortKey, sort, order, onSort, hint, className }: Props) {
  const active = sort === sortKey;
  const hintId = useId();
  return (
    <th scope="col" aria-sort={active ? ARIA_SORT[order] : undefined} className={className}>
      <button
        type="button"
        aria-describedby={hint ? hintId : undefined}
        onClick={() => onSort(sortKey)}
        className={cn(
          '-mx-1 inline-flex items-center gap-1 rounded px-1 font-semibold uppercase hover:text-slate-900',
          'focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none',
          active && 'text-slate-900',
        )}
      >
        {label}
        <SortIcon state={active ? order : 'none'} />
      </button>
      {/* `hidden`: still read as the description, but not part of the header's name. */}
      {hint && (
        <span id={hintId} hidden>
          {hint}
        </span>
      )}
    </th>
  );
}
