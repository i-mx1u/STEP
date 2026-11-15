import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bookmark,
  ChevronDown,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  PlusCircle,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/format';
import { Logo } from './Logo';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/practice', label: 'Practice', icon: PlusCircle },
  { to: '/history', label: 'History', icon: History },
  { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
];

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-ink-200 bg-white py-1 pl-1 pr-2.5 text-sm font-bold text-ink-800 shadow-sm transition hover:border-ink-300 hover:bg-ink-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-950 text-xs font-extrabold text-white">
          {user.displayName.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-[110px] truncate sm:block">{user.displayName}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 text-ink-400 transition', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-lift animate-scale-in"
          role="menu"
        >
          <div className="border-b border-ink-100 p-4">
            <p className="truncate text-sm font-bold text-ink-900">{user.displayName}</p>
            <p className="mt-0.5 truncate text-xs text-ink-400">{user.email}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-mint-50 px-2 py-0.5 text-[10px] font-bold text-mint-700">
              <span className="h-1.5 w-1.5 rounded-full bg-mint-500" />
              Synced across devices
            </p>
          </div>
          <div className="p-2">
            <Link
              to="/bookmarks"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-50 hover:text-ink-900"
              role="menuitem"
            >
              <Bookmark className="h-4 w-4" /> Saved questions
            </Link>
            <Link
              to="/history"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-50 hover:text-ink-900"
              role="menuitem"
            >
              <History className="h-4 w-4" /> Test history
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AppShell() {
  const { user, isGuest } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-lg focus:bg-ink-950 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-ink-200/60 bg-[#f7f6f2]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn('nav-link inline-flex items-center gap-2', isActive && 'nav-link-active')
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isGuest ? (
              <>
                <span className="hidden items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-bold text-ink-500 sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Guest mode
                </span>
                <Link to="/auth" className="btn-primary btn-sm sm:px-4">
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign in</span>
                  <span className="sm:hidden">Sign in</span>
                </Link>
              </>
            ) : (
              <UserMenu />
            )}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-7 sm:px-6 sm:pt-9 md:pb-12 lg:px-8">
        <Outlet />
      </main>

      <footer className="mt-auto hidden border-t border-ink-200/60 py-6 md:block">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-ink-400 sm:flex-row sm:px-6 lg:px-8">
          <p>
            <span className="font-extrabold tracking-[0.12em] text-ink-500">STEPWISE</span>{' '}
            · Saudi STEP practice, built for focus.
          </p>
          <p>
            {user ? (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Signed in as {user.email}
              </span>
            ) : (
              'Progress is saved on this device. Sign in to sync.'
            )}
          </p>
        </div>
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200/70 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="grid h-16 grid-cols-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition',
                  isActive ? 'text-brand-600' : 'text-ink-400 hover:text-ink-700',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-8 w-12 items-center justify-center rounded-full transition',
                      isActive && 'bg-brand-50',
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
