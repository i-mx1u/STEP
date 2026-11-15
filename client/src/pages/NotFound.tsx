import { Link } from 'react-router-dom';
import { ArrowRight, Compass, LayoutDashboard } from 'lucide-react';
import { Logo } from '../components/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f7f6f2]">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
        <Link
          to="/"
          className="btn-secondary btn-sm"
        >
          <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-ink-200/70 bg-white px-6 py-12 text-center shadow-soft sm:px-12">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
          <div className="relative">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Compass className="h-7 w-7" />
            </span>
            <p className="mt-6 font-display text-[5rem] font-medium leading-none tracking-tight text-ink-950">
              404
            </p>
            <h1 className="mt-3 text-xl font-extrabold text-ink-900">
              This page wandered off
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
              The link may be outdated, or the page never existed. Your practice studio is
              one click away.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link to="/" className="btn-brand">
                <LayoutDashboard className="h-4 w-4" /> Back to dashboard
              </Link>
              <Link to="/practice" className="btn-secondary">
                Build a test <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
