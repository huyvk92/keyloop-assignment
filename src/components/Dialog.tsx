import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { cn } from '@/lib/cn';

type Props = {
  /** Controlled: the parent owns the open state and closes it in `onClose`. */
  open: boolean;
  /** Called on the Close button, Escape, and a backdrop click. */
  onClose: () => void;
  /** Accessible name (`aria-labelledby`); receives focus on open. */
  title: ReactNode;
  /** Optional accessible description (`aria-describedby`). */
  description?: ReactNode;
  /**
   * Where focus goes on close when the element focused before opening is gone (e.g. its table row
   * left the list after a save). Without it, or if it returns null, focus stays on `<body>`.
   * Read at close time, so it can look up an element that only exists then (ADR-006).
   */
  returnFocusFallback?: () => HTMLElement | null;
  /** Actions pinned below the scrollable body. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Utility class toggled on `<body>` while a dialog is open; kept as a literal so Tailwind emits it. */
const SCROLL_LOCK_CLASS = 'overflow-hidden';

/**
 * Modal dialog on the native `<dialog>` + `showModal()` (ADR-006): the browser provides the top
 * layer, inert background and Escape (`cancel`). On open, focus goes to the heading (not the
 * first input) so screen readers start at the title; on close, it returns to the element that
 * was focused before opening or, if that element is gone, to `returnFocusFallback`. Content is only
 * rendered while open. Styled as a right-side drawer from `md` and a bottom sheet below it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  returnFocusFallback,
  footer,
  className,
  children,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** True when the current press started on the backdrop (not inside the content). */
  const pressOnBackdrop = useRef(false);
  /** Latest fallback, for the close cleanup (which only re-runs when `open` changes). */
  const fallbackRef = useRef(returnFocusFallback);
  useEffect(() => {
    fallbackRef.current = returnFocusFallback;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    // <body> means "nothing focused" (or the trigger already unmounted): use the fallback then.
    const active = document.activeElement;
    const trigger = active instanceof HTMLElement && active !== document.body ? active : null;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
    const body = document.body;
    const lockedBefore = body.classList.contains(SCROLL_LOCK_CLASS);
    body.classList.add(SCROLL_LOCK_CLASS);
    return () => {
      if (!lockedBefore) body.classList.remove(SCROLL_LOCK_CLASS);
      if (dialog.open) dialog.close();
      // A trigger that unmounted meanwhile can't take focus: use the explicit fallback instead
      // of leaving keyboard users on <body> (ADR-006).
      const target = trigger?.isConnected ? trigger : fallbackRef.current?.();
      target?.focus();
    };
  }, [open]);

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    // Stay controlled: the parent closes the dialog by setting `open` to false.
    event.preventDefault();
    onClose();
  };

  // The browser may close without `cancel` (e.g. Chrome after repeated Escape); sync the parent.
  // When we close it ourselves, `open` is already false here.
  const handleNativeClose = () => {
    if (open) onClose();
  };

  return (
    // The <dialog> itself is only hit by backdrop clicks: the content box fills it (p-0).
    // Escape is the keyboard equivalent of the backdrop click, so no key handler is needed here.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onPointerDown={(event) => {
        pressOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressOnBackdrop.current && event.target === event.currentTarget) onClose();
        pressOnBackdrop.current = false;
      }}
      className={cn(
        // Below md: a full-width bottom sheet. From md: a full-height drawer on the right (ADR-006).
        'mx-0 mt-auto mb-0 max-h-[calc(100dvh-2rem)] w-full max-w-full overflow-hidden p-0',
        'rounded-t-xl bg-white text-slate-900 shadow-xl backdrop:bg-slate-900/50',
        'md:my-0 md:mr-0 md:ml-auto md:h-dvh md:max-h-dvh md:max-w-xl md:rounded-none',
        // Slides in from the bottom (sheet) or the right (drawer), unless reduced motion is set.
        'motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out',
        'motion-safe:starting:open:translate-y-full',
        'md:motion-safe:starting:open:translate-x-full md:motion-safe:starting:open:translate-y-0',
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col md:h-full">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <div className="min-w-0 space-y-1">
              <h2
                id={titleId}
                ref={headingRef}
                tabIndex={-1}
                className="text-xl font-semibold focus:outline-none"
              >
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-sm text-slate-600">
                  {description}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('common.close')}>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-4"
              >
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-6 py-4">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
