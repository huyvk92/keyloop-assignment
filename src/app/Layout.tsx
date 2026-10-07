import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/cn';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none',
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-900',
  );

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
        <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-sm text-slate-500">
        © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
