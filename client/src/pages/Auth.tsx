import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/format';
import type { BankMeta } from '../types';
import { Logo, LogoMark } from '../components/Logo';
import { BilingualLabel, Button, InlineAlert, Spinner } from '../components/ui';

type Mode = 'login' | 'register';

export default function AuthPage() {
  const { login, register, user, ready } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const rawNext = params.get('next') || '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<BankMeta | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .catalog(controller.signal)
      .then((response) => setMeta(response.meta))
      .catch(() => {
        // The auth flow does not depend on the catalog.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (ready && user) navigate(next, { replace: true });
  }, [ready, user, next, navigate]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === 'register' && name.trim().length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        const account = await register(name.trim(), email.trim(), password);
        toast.success(
          'Welcome to STEPWISE',
          `${account.displayName}, your progress will now sync across devices.`,
        );
      } else {
        const account = await login(email.trim(), password);
        toast.success('Welcome back', `Good to see you, ${account.displayName}.`);
      }
      navigate(next, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong. Please try again in a moment.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f6f2] lg:grid lg:grid-cols-[1.02fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-ink-950 p-8 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.16]" />
        <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-mint-500/15 blur-3xl" />

        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-3">
            <LogoMark tone="dark" className="h-11 w-11 border border-white/10" />
            <span className="flex flex-col leading-none">
              <span className="text-[17px] font-extrabold tracking-[0.16em]">STEPWISE</span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-ink-400">
                STEP Practice Studio
              </span>
            </span>
          </Link>
        </div>

        <div className="relative max-w-lg">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-300">
            <span className="h-px w-6 bg-brand-400/70" /> One account. Every device.
          </p>
          <h1 className="mt-5 text-balance font-display text-[2.8rem] font-medium leading-[1.05] tracking-[-0.03em] xl:text-[3.2rem]">
            Your progress,
            <span className="block text-ink-300">wherever you practice.</span>
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-ink-300">
            Sign in to keep test history, scores and bookmarks in sync. Build a personal
            review library that follows you from laptop to phone.
          </p>

          <ul className="mt-8 space-y-3.5">
            {[
              {
                icon: Cloud,
                title: 'Cross-device history',
                text: 'Every attempt, score and answer review saved safely.',
              },
              {
                icon: BookOpen,
                title: 'A review library that grows',
                text: 'Bookmarks and saved mistakes, ready for a focused session.',
              },
              {
                icon: ShieldCheck,
                title: 'Private by design',
                text: 'Your account only stores your own attempts and saved questions.',
              },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-300">
                  <item.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-400">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-4 text-[11px] font-semibold text-ink-400">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            {(meta?.totals.playable ?? 2982).toLocaleString()} playable questions
          </span>
          <span className="h-3 w-px bg-white/15" />
          <span>{meta?.totals.models ?? 47} STEP models</span>
        </div>
      </aside>

      {/* Form panel */}
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-4 py-4 sm:px-6 lg:justify-end">
          <div className="lg:hidden">
            <Logo />
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-md">
            <div className="mb-7 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-950 text-white shadow-soft">
                <Sparkles className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-display text-3xl font-medium tracking-tight text-ink-950">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="mt-1.5 text-sm text-ink-500">
                {mode === 'login'
                  ? 'Sign in to sync your tests, scores and bookmarks.'
                  : 'Start free. Your guest data can be imported after signing up.'}
              </p>
            </div>

            <div className="surface p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100/80 p-1">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-bold transition',
                    mode === 'login'
                      ? 'bg-white text-ink-950 shadow-sm'
                      : 'text-ink-500 hover:text-ink-800',
                  )}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-bold transition',
                    mode === 'register'
                      ? 'bg-white text-ink-950 shadow-sm'
                      : 'text-ink-500 hover:text-ink-800',
                  )}
                >
                  Create account
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {mode === 'register' ? (
                  <div>
                    <label htmlFor="name" className="label">
                      Your name
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="e.g. Sara Alahmadi"
                        autoComplete="name"
                        className="input pl-9"
                        required
                      />
                    </div>
                  </div>
                ) : null}

                <div>
                  <label htmlFor="email" className="label">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="input pl-9"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="label">
                      Password
                    </label>
                    {mode === 'register' ? (
                      <span className="mb-1.5 text-[10px] font-semibold text-ink-400">
                        At least 8 characters
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={mode === 'register' ? 'Create a strong password' : 'Your password'}
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      className="input pl-9 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error ? (
                  <InlineAlert tone="warn">
                    <span>{error}</span>
                  </InlineAlert>
                ) : null}

                <Button
                  type="submit"
                  variant="brand"
                  className="w-full py-3"
                  loading={busy}
                  disabled={busy}
                >
                  {!busy ? <ArrowRight className="h-4 w-4" /> : null}
                  <BilingualLabel
                    en={mode === 'login' ? 'Sign in to STEPWISE' : 'Create my account'}
                    ar={mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
                  />
                </Button>
              </form>

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2.5 text-[11px] leading-relaxed text-ink-500">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-mint-500" />
                <span>
                  No credit card required. Your account is optional — guest mode keeps
                  working on this device.
                </span>
              </div>
            </div>

            <div className="mt-5 text-center">
              <Link
                to="/practice"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-500 transition hover:text-ink-900"
              >
                Continue as guest <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </Link>
            </div>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[10px] leading-relaxed text-ink-400">
              <ShieldCheck className="h-3 w-3" />
              Passwords are hashed with bcrypt. Sessions use signed JWT tokens.
            </p>
          </div>
        </main>

        {busy ? (
          <div className="sr-only" role="status">
            <Spinner /> Signing you in…
          </div>
        ) : null}
      </div>
    </div>
  );
}
