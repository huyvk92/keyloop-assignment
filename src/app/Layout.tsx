import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const MAIN_ID = 'main';

export function Layout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      {/* Moves focus itself (not only the scroll position) so the next Tab starts inside <main>,
          and leaves the URL alone (a `#main` hash would add a history entry). */}
      <a
        href={`#${MAIN_ID}`}
        onClick={(event) => {
          event.preventDefault();
          document.getElementById(MAIN_ID)?.focus();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
      >
        {t('layout.skipToContent')}
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <nav aria-label={t('layout.mainNav')} className="flex items-center gap-2">
            <Link
              to="/"
              className="rounded-md px-1 py-1 text-lg font-semibold text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
            >
              {t('layout.brand')}
            </Link>
          </nav>
          {/* Outside the nav: it changes the language, it does not navigate (TA-25). */}
          <LanguageSwitcher />
        </div>
      </header>
      {/* Programmatic focus target of the skip link only; not in the Tab order. */}
      <main
        id={MAIN_ID}
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 focus:outline-none"
      >
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-sm text-slate-600">
        {t('layout.copyright', { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
