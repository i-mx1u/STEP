import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock,
  Cloud,
  Flame,
  History,
  Layers,
  LogIn,
  PenLine,
  Play,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Target,
  Timer,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import {
  computeStats,
  formatDate,
  formatDuration,
  greeting,
  presetToParams,
  type PresetDefinition,
} from '../lib/format';
import {
  getActiveSession,
  getLocalBookmarks,
  getLocalHistory,
} from '../lib/storage';
import { importGuestData } from '../lib/results';
import type { CatalogResponse, DashboardStats, TestSummary } from '../types';
import {
  Button,
  ProgressBar,
  ScoreRing,
  SectionPill,
  StatCard,
  InlineAlert,
} from '../components/ui';

const presets: Array<
  PresetDefinition & { icon: typeof Sparkles; accent: string; iconBg: string }
> = [
  {
    id: 'warmup',
    name: 'Warm-up',
    arabic: 'تدريب سريع',
    description: 'A light mix of reading and grammar to settle into focus.',
    minutes: '10 questions · 10 min',
    sections: ['reading', 'grammar'],
    readingCount: 5,
    grammarCount: 5,
    secondsPerQuestion: 60,
    icon: Sparkles,
    accent: 'text-brand-700',
    iconBg: 'bg-brand-50 text-brand-600',
  },
  {
    id: 'grammar',
    name: 'Grammar sprint',
    arabic: 'تركيز القواعد',
    description: 'Twenty rapid grammar items to sharpen accuracy.',
    minutes: '20 questions · 20 min',
    sections: ['grammar'],
    readingCount: 0,
    grammarCount: 20,
    secondsPerQuestion: 60,
    icon: PenLine,
    accent: 'text-mint-700',
    iconBg: 'bg-mint-50 text-mint-600',
  },
  {
    id: 'reading',
    name: 'Reading focus',
    arabic: 'تركيز القراءة',
    description: 'Passage-based practice with a sticky reading panel.',
    minutes: '20 questions · 20 min',
    sections: ['reading'],
    readingCount: 20,
    grammarCount: 0,
    secondsPerQuestion: 60,
    icon: BookOpen,
    accent: 'text-brand-700',
    iconBg: 'bg-brand-50 text-brand-600',
  },
  {
    id: 'full',
    name: 'Full mock',
    arabic: 'اختبار كامل',
    description: 'A complete timed simulation across both sections.',
    minutes: '60 questions · 60 min',
    sections: ['reading', 'grammar'],
    readingCount: 30,
    grammarCount: 30,
    secondsPerQuestion: 60,
    icon: Layers,
    accent: 'text-ink-800',
    iconBg: 'bg-ink-100 text-ink-600',
  },
];

function RecentRow({ test }: { test: TestSummary }) {
  return (
    <Link
      to={`/results/${test.id}`}
      className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-ink-50/70 sm:px-5"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-inset ring-ink-200/70">
        <span className="text-sm font-extrabold tabular-nums text-ink-900">
          {test.score}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink-900">{test.config.label}</p>
        <p className="mt-0.5 truncate text-xs text-ink-400">
          {formatDate(test.completedAt)} · {test.correctCount}/{test.totalCount} correct ·{' '}
          {formatDuration(test.durationSeconds)}
        </p>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        {test.config.sections.map((section) => (
          <SectionPill key={section} section={section} />
        ))}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-500" />
    </Link>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="surface p-5">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton mt-3 h-7 w-16" />
          <div className="skeleton mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user, isGuest, ready } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeSession] = useState(() => getActiveSession());
  const [localDataCount, setLocalDataCount] = useState(
    () => getLocalHistory().length + getLocalBookmarks().length,
  );
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .catalog(controller.signal)
      .then((response) => setCatalog(response))
      .catch(() => {
        // The builder still works without the catalog; the hero falls back to defaults.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoadingStats(true);

    const localStats = computeStats(getLocalHistory());

    if (isGuest) {
      setStats(localStats);
      setLoadingStats(false);
      return () => controller.abort();
    }

    api
      .getStats(controller.signal)
      .then(({ stats: serverStats }) => setStats(serverStats))
      .catch(() => {
        if (!controller.signal.aborted) setStats(localStats);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStats(false);
      });

    return () => controller.abort();
  }, [ready, isGuest, user?.id, refreshKey]);

  const allModelIds = useMemo(
    () => catalog?.catalog.models.map((model) => model.id) ?? [],
    [catalog],
  );

  const startPreset = (preset: PresetDefinition) => {
    navigate(`/practice?${presetToParams(preset, allModelIds)}`);
  };

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const result = await importGuestData();
      setLocalDataCount(getLocalHistory().length + getLocalBookmarks().length);
      setRefreshKey((value) => value + 1);
      if (result.failed) {
        toast.error(
          'Some local records could not be imported',
          `${result.failed} item${result.failed === 1 ? '' : 's'} stayed on this device. Please try again.`,
        );
      } else {
        toast.success(
          'Local progress imported',
          `${result.tests} test${result.tests === 1 ? '' : 's'} and ${result.bookmarks} bookmark${result.bookmarks === 1 ? '' : 's'} are now synced.`,
        );
      }
    } catch {
      toast.error('Import failed', 'Please check your connection and try again.');
    } finally {
      setImporting(false);
    }
  }, [toast]);

  const readingAverage = stats?.readingAverage ?? null;
  const grammarAverage = stats?.grammarAverage ?? null;
  const lastTest = stats?.recent[0];
  const readinessScore = stats?.averageScore ?? 0;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-ink-950 px-5 py-8 text-white shadow-lift sm:px-8 sm:py-10 lg:px-10">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.18]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-mint-500/15 blur-3xl" />

        <div className="relative grid items-center gap-8 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-300">
              <span className="h-px w-6 bg-brand-400/70" />
              STEP readiness, without the noise
            </p>
            <h1 className="mt-4 max-w-2xl text-balance font-display text-[2.5rem] font-medium leading-[1.05] tracking-[-0.03em] sm:text-[3.25rem]">
              {ready && user ? greeting(user.displayName) : 'Practice with purpose.'}
              <span className="block text-ink-300">Walk into STEP ready.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-300 sm:text-[15px]">
              Build focused tests from {catalog?.meta.totals.models ?? 47} real STEP models,
              keep your reading passage in view, and turn every mistake into a saved review
              card.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link to="/practice" className="btn-brand px-5 py-3">
                <PlusCircle className="h-4 w-4" />
                <span className="flex flex-col items-start leading-tight">
                  <span>Build a practice test</span>
                  <span dir="rtl" lang="ar" className="font-arabic text-[10px] opacity-65">
                    أنشئ اختبار تدريبي
                  </span>
                </span>
              </Link>
              {activeSession ? (
                <Link
                  to={`/test/${activeSession.test.id}`}
                  className="btn border border-white/15 bg-white/10 px-5 py-3 text-white backdrop-blur hover:bg-white/15"
                >
                  <Play className="h-4 w-4" />
                  Resume {activeSession.test.questions.length}-question test
                </Link>
              ) : lastTest ? (
                <Link
                  to={`/results/${lastTest.id}`}
                  className="btn border border-white/15 bg-white/10 px-5 py-3 text-white backdrop-blur hover:bg-white/15"
                >
                  <RotateCcw className="h-4 w-4" />
                  Review last attempt
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => startPreset(presets[0])}
                  className="btn border border-white/15 bg-white/10 px-5 py-3 text-white backdrop-blur hover:bg-white/15"
                >
                  <Sparkles className="h-4 w-4" />
                  Quick 10-question start
                </button>
              )}
            </div>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-semibold text-ink-400">
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-brand-300" />
                {catalog?.meta.totals.playable.toLocaleString() ?? '2,982'} playable questions
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-mint-300" />
                {catalog?.meta.totals.passages ?? 528} reading passages
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5 text-ink-300" />
                Flexible timer, 1 min/question by default
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">
                    Your readiness
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {stats?.completedTests
                      ? `${stats.completedTests} completed ${stats.completedTests === 1 ? 'test' : 'tests'}`
                      : 'No attempts yet'}
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-ink-300">
                  {isGuest ? 'Guest' : 'Synced'}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div className="rounded-full bg-white p-2">
                  <ScoreRing score={readinessScore} size={110} stroke={9} />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-ink-300">Reading</span>
                      <span className="text-white">
                        {readingAverage === null ? '—' : `${readingAverage}%`}
                      </span>
                    </div>
                    <ProgressBar
                      value={readingAverage ?? 0}
                      className="mt-1.5 h-1.5 bg-white/10"
                      barClassName="bg-brand-400"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-ink-300">Grammar</span>
                      <span className="text-white">
                        {grammarAverage === null ? '—' : `${grammarAverage}%`}
                      </span>
                    </div>
                    <ProgressBar
                      value={grammarAverage ?? 0}
                      className="mt-1.5 h-1.5 bg-white/10"
                      barClassName="bg-mint-400"
                    />
                  </div>
                  <p className="text-[10px] leading-relaxed text-ink-400">
                    {stats?.completedTests
                      ? `Best score ${stats.bestScore}% · ${stats.streakDays}-day streak`
                      : 'Finish a test to unlock your score breakdown.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {loadingStats || !stats ? (
        <StatsSkeleton />
      ) : (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Your stats">
          <StatCard
            label="Tests completed"
            value={stats.completedTests}
            detail={`${stats.totalQuestions.toLocaleString()} questions attempted`}
            icon={<Target className="h-5 w-5" />}
            accent="brand"
          />
          <StatCard
            label="Average score"
            value={`${stats.averageScore}%`}
            detail={stats.completedTests ? 'Across all saved attempts' : 'Take your first test'}
            icon={<TrendingUpIcon />}
            accent="mint"
          />
          <StatCard
            label="Personal best"
            value={`${stats.bestScore}%`}
            detail={stats.bestScore ? 'Your highest saved result' : 'A new record is waiting'}
            icon={<Trophy className="h-5 w-5" />}
            accent="amber"
          />
          <StatCard
            label="Daily streak"
            value={`${stats.streakDays} ${stats.streakDays === 1 ? 'day' : 'days'}`}
            detail={stats.streakDays ? 'Keep the chain alive' : 'Practice today to start'}
            icon={<Flame className="h-5 w-5" />}
            accent="ink"
          />
        </section>
      )}

      {user && localDataCount > 0 ? (
        <InlineAlert tone="info" title="Progress saved on this device">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              You have {localDataCount} guest record{localDataCount === 1 ? '' : 's'} on this
              device. Import them into your account once to keep everything in sync.
            </span>
            <Button
              size="sm"
              variant="brand"
              className="shrink-0"
              onClick={handleImport}
              loading={importing}
            >
              <Cloud className="h-4 w-4" /> Import to account
            </Button>
          </div>
        </InlineAlert>
      ) : null}

      {isGuest ? (
        <div className="surface flex flex-col gap-3 border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Cloud className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink-900">You are practicing as a guest</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                Results and bookmarks stay in this browser. Create a free account to sync
                across devices.
              </p>
            </div>
          </div>
          <Link to="/auth" className="btn-secondary btn-sm shrink-0">
            <LogIn className="h-4 w-4" /> Sign in or create account
          </Link>
        </div>
      ) : null}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Quick start</p>
            <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-ink-950">
              Choose a lane and begin
            </h2>
          </div>
          <Link
            to="/practice"
            className="hidden items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 sm:inline-flex"
          >
            Customize a test <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => startPreset(preset)}
              className="surface group flex flex-col p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-lift sm:p-5"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${preset.iconBg}`}
                >
                  <preset.icon className="h-5 w-5" />
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-50 text-ink-400 transition group-hover:bg-ink-950 group-hover:text-white">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-ink-900">{preset.name}</h3>
                <span dir="rtl" lang="ar" className="font-arabic text-[10px] text-ink-400">
                  {preset.arabic}
                </span>
              </div>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-ink-500">
                {preset.description}
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-400">
                <Clock className="h-3 w-3" />
                {preset.minutes}
              </p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-200/70 px-4 py-4 sm:px-5">
            <div>
              <p className="eyebrow">Your progress</p>
              <h2 className="mt-1 text-lg font-extrabold text-ink-900">Recent attempts</h2>
            </div>
            <Link
              to="/history"
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800"
            >
              View history <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loadingStats ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="skeleton h-11 w-11" />
                  <div className="flex-1">
                    <div className="skeleton h-3.5 w-2/3" />
                    <div className="skeleton mt-2 h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats && stats.recent.length > 0 ? (
            <div className="divide-y divide-ink-100">
              {stats.recent.map((test) => (
                <RecentRow key={test.id} test={test} />
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
                <History className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-bold text-ink-900">No attempts saved yet</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-500">
                Your first completed test will appear here with a full question-by-question
                review.
              </p>
              <Link to="/practice" className="btn-brand btn-sm mt-4">
                <Play className="h-3.5 w-3.5" /> Start practicing
              </Link>
            </div>
          )}
        </section>

        <section className="surface p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Section balance</p>
              <h2 className="mt-1 text-lg font-extrabold text-ink-900">Where to focus</h2>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Target className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-ink-800">
                  <BookOpen className="h-4 w-4 text-brand-500" /> Reading
                </span>
                <span className="text-sm font-extrabold tabular-nums text-ink-900">
                  {readingAverage === null ? '—' : `${readingAverage}%`}
                </span>
              </div>
              <ProgressBar
                value={readingAverage ?? 0}
                className="mt-2"
                barClassName="bg-brand-500"
              />
              <p className="mt-1.5 text-[11px] text-ink-400">
                {readingAverage === null
                  ? 'No reading attempts yet.'
                  : readingAverage >= 80
                    ? 'Strong — keep passages in your weekly rotation.'
                    : 'Practice passage sets and review every wrong option.'}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-ink-800">
                  <PenLine className="h-4 w-4 text-mint-500" /> Grammar
                </span>
                <span className="text-sm font-extrabold tabular-nums text-ink-900">
                  {grammarAverage === null ? '—' : `${grammarAverage}%`}
                </span>
              </div>
              <ProgressBar
                value={grammarAverage ?? 0}
                className="mt-2"
                barClassName="bg-mint-500"
              />
              <p className="mt-1.5 text-[11px] text-ink-400">
                {grammarAverage === null
                  ? 'No grammar attempts yet.'
                  : grammarAverage >= 80
                    ? 'Accurate work — try timed sprints to build speed.'
                    : 'Short grammar drills will move this number fastest.'}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-ink-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">
              Suggested next step
            </p>
            <p className="mt-1 text-sm font-bold text-ink-900">
              {!stats?.completedTests
                ? 'Start with a 10-question warm-up.'
                : (readingAverage ?? 100) < (grammarAverage ?? 100)
                  ? 'Give reading passages extra attention today.'
                  : 'Try a timed grammar sprint to build speed.'}
            </p>
            <button
              type="button"
              onClick={() =>
                startPreset(
                  (readingAverage ?? 100) < (grammarAverage ?? 100)
                    ? presets[2]
                    : presets[1],
                )
              }
              className="btn-soft btn-sm mt-3 w-full"
            >
              Start suggested drill <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function TrendingUpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  );
}
