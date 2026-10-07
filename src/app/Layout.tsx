import { Link, Outlet } from 'react-router';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <nav aria-label="Main" className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
          <Link
            to="/"
            className="rounded-md px-1 py-1 text-lg font-semibold text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          >
            Inventory Dashboard
          </Link>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-sm text-slate-500">
        © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
