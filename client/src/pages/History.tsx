import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock,
  Cloud,
  History as HistoryIcon,
  Layers,
  ListChecks,
  LogIn,
  PenLine,
  PlusCircle,
  Target,
  Timer,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../lib/api';
import {
  computeStats,
  formatDate,
  formatDuration,
  pluralize,
  cn,
} from '../lib/format';
import { deleteTestRecord, loadHistory } from '../lib/results';
import { removeCachedTestResult } from '../lib/storage';
import type { TestSummary } from '../types';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  PageHeader,
  ProgressBar,
  SectionPill,
  Spinner,
  StatCard,
} from '../components/ui';

type HistoryFilter = 'all' | 'reading' | 'grammar' | 'mixed';

function HistoryRow({
  test,
  onDelete,
}: {
  test: TestSummary;
  onDelete: () => void;
}) {
  const toneClasses =
    test.score >= 80
      ? 'bg-mint-50 text-mint-700'
      : test.score >= 60
        ? 'bg-amber-50 text-amber-700'
        : 'bg-rose-50 text-rose-600';

  return (
    <div className="group flex items-center gap-3 px-3 py-3.5 transition hover:bg-ink-50/60 sm:px-4">
      <Link
        to={`/results/${test.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
        aria-label={`Open result for ${test.config.label}`}
      >
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl',
            toneClasses,
          )}
        >
          <span className="text-sm font-extrabold tabular-nums leading-none">
            {test.score}%
          </span>
          <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wide opacity-70">
            score
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-extrabold text-ink-900">
              {test.config.label}
            </p>
            {test.config.sections.map((section) => (
              <SectionPill key={section} section={section} className="hidden sm:inline-flex" />
            ))}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-400">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatDate(test.completedAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3 w-3" />
              {test.correctCount}/{test.totalCount} correct
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(test.durationSeconds)}
            </span>
          </p>
        </div>

        <div className="hidden w-48 shrink-0 sm:block">
          <div className="flex items-center justify-between text-[10px] font-bold text-ink-400">
            <span>Accuracy</span>
            <span>{test.totalCount ? Math.round((test.correctCount / test.totalCount) * 100) : 0}%</span>
          </div>
          <ProgressBar value={test.score} className="mt-1.5 h-1.5" />
        </div>
      </Link>

      <Link
        to={`/results/${test.id}`}
        className="hidden rounded-lg p-2 text-ink-300 transition hover:bg-white hover:text-ink-700 sm:flex"
        aria-label="Review test"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg p-2 text-ink-300 transition hover:bg-rose-50 hover:text-rose-600"
        aria-label="Delete test"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function HistoryPage() {
  const { isGuest, user, ready } = useAuth();
  const toast = useToast();
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [target, setTarget] = useState<TestSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    setLoadError(null);

    loadHistory(250)
      .then((loaded) => {
        if (active) setTests(loaded);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'History could not be loaded. Check your connection and try again.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ready, user?.id, isGuest, retryKey]);

  const stats = useMemo(() => computeStats(tests), [tests]);
  const totalPracticeTime = useMemo(
    () => tests.reduce((sum, test) => sum + test.durationSeconds, 0),
    [tests],
  );

  const counts = useMemo(
    () => ({
      all: tests.length,
      reading: tests.filter((test) => test.config.sections.includes('reading')).length,
      grammar: tests.filter((test) => test.config.sections.includes('grammar')).length,
      mixed: tests.filter((test) => test.config.sections.length === 2).length,
    }),
    [tests],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return tests;
    if (filter === 'mixed') {
      return tests.filter((test) => test.config.sections.length === 2);
    }
    return tests.filter((test) => test.config.sections.includes(filter));
  }, [tests, filter]);

  const handleDelete = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await deleteTestRecord(target.id);
      removeCachedTestResult(target.id);
      setTests((current) => current.filter((test) => test.id !== target.id));
      toast.success('Test deleted', 'The attempt was removed from your history.');
      setTarget(null);
    } catch (error) {
      toast.error(
        'Could not delete the test',
        error instanceof ApiError ? error.message : 'Please try again.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your journey"
        title="Test history"
        description="Every completed test is saved with a full answer review. Open an attempt to see what worked and save mistakes for later."
        action={
          <Link to="/practice" className="btn-brand">
            <PlusCircle className="h-4 w-4" />
            <span className="flex flex-col items-start leading-tight">
              <span>New practice test</span>
              <span dir="rtl" lang="ar" className="font-arabic text-[10px] opacity-70">
                اختبار جديد
              </span>
            </span>
          </Link>
        }
      />

      {isGuest ? (
        <div className="surface flex flex-col gap-3 border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Cloud className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink-900">Guest history</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                These attempts live in this browser only. Create an account to keep them
                safe and see them on every device.
              </p>
            </div>
          </div>
          <Link to="/auth" className="btn-secondary btn-sm shrink-0">
            <LogIn className="h-4 w-4" /> Sync my progress
          </Link>
        </div>
      ) : null}

      {loadError ? (
        <InlineAlert tone="warn" title="History unavailable">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{loadError}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setRetryKey((value) => value + 1)}
            >
              Try again
            </Button>
          </div>
        </InlineAlert>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="History stats">
        <StatCard
          label="Attempts"
          value={stats.completedTests}
          detail="Completed tests saved"
          icon={<Target className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Average"
          value={`${stats.averageScore}%`}
          detail={`${stats.totalCorrect.toLocaleString()} correct answers`}
          icon={<Trophy className="h-5 w-5" />}
          accent="mint"
        />
        <StatCard
          label="Best score"
          value={`${stats.bestScore}%`}
          detail="Your personal record"
          icon={<Target className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Practice time"
          value={formatDuration(totalPracticeTime)}
          detail={`${stats.totalQuestions.toLocaleString()} questions attempted`}
          icon={<Timer className="h-5 w-5" />}
          accent="ink"
        />
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ink-200/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl bg-ink-100/70 p-1">
            {(
              [
                { key: 'all', label: `All (${counts.all})`, icon: ListChecks },
                { key: 'reading', label: `Reading (${counts.reading})`, icon: BookOpen },
                { key: 'grammar', label: `Grammar (${counts.grammar})`, icon: PenLine },
                { key: 'mixed', label: `Mixed (${counts.mixed})`, icon: Layers },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition',
                  filter === item.key
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-500 hover:text-ink-800',
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] font-semibold text-ink-400">
            {filtered.length} {pluralize(filtered.length, 'attempt')} shown
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner className="h-5 w-5 text-brand-600" />
            <p className="mt-2 text-xs font-semibold text-ink-400">
              Loading your history…
            </p>
          </div>
        ) : filtered.length ? (
          <div className="divide-y divide-ink-100">
            {filtered.map((test) => (
              <HistoryRow
                key={test.id}
                test={test}
                onDelete={() => setTarget(test)}
              />
            ))}
          </div>
        ) : tests.length ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-bold text-ink-900">No attempts in this view</p>
            <p className="mt-1 text-xs text-ink-500">
              Try another filter to see the rest of your history.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => setFilter('all')}
            >
              Show all attempts
            </Button>
          </div>
        ) : (
          <div className="px-5 py-4">
            <EmptyState
              icon={<HistoryIcon className="h-6 w-6" />}
              title="Your first attempt is waiting"
              description="Finish a practice test and it will appear here with a detailed score breakdown, question review and saved mistakes."
              action={
                <Link to="/practice" className="btn-brand">
                  <PlusCircle className="h-4 w-4" /> Build your first test
                </Link>
              }
              className="border-0 bg-transparent shadow-none"
            />
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        onConfirm={handleDelete}
        title="Delete this attempt?"
        description={
          target
            ? `${target.config.label} scored ${target.score}% on ${formatDate(target.completedAt)}. This removes the review and cannot be undone.`
            : ''
        }
        confirmLabel="Delete attempt"
        cancelLabel="Keep it"
        tone="danger"
        busy={deleting}
        icon={
          <>
            <Trash2 className="h-4 w-4 shrink-0 text-rose-500" />
            <span>Bookmarks created from this test are kept separately.</span>
          </>
        }
      />
    </div>
  );
}
