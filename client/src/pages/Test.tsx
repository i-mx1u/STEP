import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Grid3X3,
  LogOut,
  PenLine,
  Send,
  TimerReset,
  X,
  XCircle,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import {
  cn,
  formatClock,
  groupQuestions,
  pluralize,
  sectionLabel,
} from '../lib/format';
import { completeTest, isSignedIn, toggleBookmark } from '../lib/results';
import {
  clearActiveSession,
  getActiveSession,
  saveActiveSession,
} from '../lib/storage';
import type { ActiveTestSession, TestQuestion } from '../types';
import { LogoMark } from '../components/Logo';
import { PassageText } from '../components/PassageText';
import {
  BilingualLabel,
  Button,
  ConfirmDialog,
  SectionPill,
  Spinner,
} from '../components/ui';

function OptionRow({
  question,
  label,
  text,
  selected,
  revealed,
  onSelect,
}: {
  question: TestQuestion;
  label: string;
  text: string;
  selected: boolean;
  revealed: boolean;
  onSelect: () => void;
}) {
  const isCorrect = revealed && label === question.correctAnswer;
  const isWrong = revealed && selected && label !== question.correctAnswer;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={revealed}
      aria-pressed={selected}
      className={cn(
        'group flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-150 sm:p-4',
        'disabled:cursor-default disabled:opacity-100',
        isCorrect
          ? 'border-mint-400 bg-mint-50/80 ring-1 ring-inset ring-mint-200'
          : isWrong
            ? 'border-rose-300 bg-rose-50/80 ring-1 ring-inset ring-rose-200'
            : selected
              ? 'border-brand-400 bg-brand-50/60 ring-1 ring-inset ring-brand-200'
              : revealed
                ? 'border-ink-200 bg-white opacity-50'
                : 'border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/30',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold transition sm:h-8 sm:w-8',
          isCorrect
            ? 'bg-mint-600 text-white'
            : isWrong
              ? 'bg-rose-600 text-white'
              : selected
                ? 'bg-brand-600 text-white'
                : 'bg-ink-100 text-ink-500 group-hover:bg-white group-hover:text-brand-700',
        )}
      >
        {label}
      </span>
      <span className="min-w-0 flex-1 text-sm leading-relaxed text-ink-800 sm:text-[15px]">
        {text}
      </span>
      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
        {isCorrect ? (
          <CheckCircle2 className="h-5 w-5 text-mint-600" />
        ) : isWrong ? (
          <XCircle className="h-5 w-5 text-rose-600" />
        ) : selected ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        ) : null}
      </span>
      <span className="sr-only">
        {isCorrect ? 'Correct answer' : isWrong ? 'Your answer, incorrect' : ''}
      </span>
    </button>
  );
}

export default function TestPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [session, setSession] = useState<ActiveTestSession | null>(null);
  const [ready, setReady] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mobileTab, setMobileTab] = useState<'passage' | 'question'>('question');
  const submittedRef = useRef(false);

  useEffect(() => {
    const stored = getActiveSession();
    if (!stored || stored.test.id !== id) {
      setNotFound(true);
      setReady(true);
      return;
    }

    const clampedIndex = Math.min(
      Math.max(0, stored.currentIndex),
      stored.test.questions.length - 1,
    );
    const loaded: ActiveTestSession = { ...stored, currentIndex: clampedIndex };
    setSession(loaded);
    setRemaining(
      loaded.untimed || !loaded.deadline
        ? 0
        : Math.max(0, Math.ceil((loaded.deadline - Date.now()) / 1000)),
    );
    setReady(true);

    if (isSignedIn()) {
      const controller = new AbortController();
      api
        .listBookmarks(controller.signal)
        .then(({ bookmarks }) => {
          const ids = new Set(bookmarks.map((bookmark) => bookmark.questionId));
          setSession((current) => {
            if (!current) return current;
            const inTest = new Set(current.test.questions.map((question) => question.id));
            const merged = [...new Set([...current.bookmarked, ...ids])].filter((value) =>
              inTest.has(value),
            );
            return { ...current, bookmarked: merged };
          });
        })
        .catch(() => {
          // Bookmark sync is non-critical; the test can continue offline.
        });
      return () => controller.abort();
    }
  }, [id]);

  // Persist every meaningful change so a refresh never loses answers.
  useEffect(() => {
    if (!session || submittedRef.current) return;
    saveActiveSession(session);
  }, [session]);

  // Countdown.
  useEffect(() => {
    if (!ready || !session || session.untimed || !session.deadline) return;
    const tick = () => {
      setRemaining(Math.max(0, Math.ceil((session.deadline! - Date.now()) / 1000)));
    };
    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [ready, session?.deadline, session?.untimed]);

  const currentIndex = session?.currentIndex ?? 0;
  const questions = session?.test.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const answeredCount = useMemo(
    () => Object.values(session?.answers ?? {}).filter(Boolean).length,
    [session?.answers],
  );
  const bookmarkedCount = session?.bookmarked.length ?? 0;
  const totalQuestions = questions.length;
  const currentGroup = useMemo(
    () =>
      session
        ? groupQuestions(session.test.questions).find(
            (group) =>
              currentIndex >= group.startIndex &&
              currentIndex < group.startIndex + group.questions.length,
          )
        : undefined,
    [session, currentIndex],
  );

  const isRevealed = Boolean(
    currentQuestion && session?.revealed.includes(currentQuestion.id),
  );
  const isBookmarked = Boolean(
    currentQuestion && session?.bookmarked.includes(currentQuestion.id),
  );
  const selectedAnswer = currentQuestion
    ? (session?.answers[currentQuestion.id] ?? null)
    : null;

  const finishTest = useCallback(
    async (auto = false) => {
      if (!session || submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      setShowFinish(false);
      setDrawerOpen(false);

      const now = Date.now();
      const started = new Date(session.startedAt).getTime();
      const elapsed = Number.isFinite(started)
        ? Math.max(0, Math.round((now - started) / 1000))
        : 0;
      const duration = session.untimed
        ? Math.min(elapsed, 86_400)
        : Math.min(session.test.totalSeconds, Math.max(0, elapsed));

      try {
        if (auto) {
          toast.info('Time is up', 'Your test was submitted automatically and is being scored.');
        }
        const result = await completeTest(
          session.test,
          session.answers,
          duration,
          session.startedAt,
        );
        clearActiveSession();
        if (!result.synced) {
          toast.error(
            'Saved on this device only',
            result.error ||
              'Sign in again to sync this result with your account history.',
          );
        }
        navigate(`/results/${result.test.id}`, {
          replace: true,
          state: { fresh: true, auto },
        });
      } catch {
        submittedRef.current = false;
        setSubmitting(false);
        toast.error(
          'Could not save your test',
          'Your answers are still saved. Please try finishing again.',
        );
      }
    },
    [session, navigate, toast],
  );

  // Auto-submit exactly when the countdown reaches zero.
  useEffect(() => {
    if (!ready || !session || session.untimed || !session.deadline) return;
    if (remaining <= 0) void finishTest(true);
  }, [ready, remaining, session, finishTest]);

  // Body scroll lock for the question map drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  const goToQuestion = (index: number) => {
    if (!session) return;
    const next = Math.max(0, Math.min(questions.length - 1, index));
    setSession((current) => (current ? { ...current, currentIndex: next } : current));
    setMobileTab('question');
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectAnswer = (label: string) => {
    if (!session || !currentQuestion || isRevealed) return;
    setSession((current) =>
      current
        ? {
            ...current,
            answers: { ...current.answers, [currentQuestion.id]: label },
          }
        : current,
    );
  };

  const toggleReveal = () => {
    if (!session || !currentQuestion) return;
    setSession((current) => {
      if (!current) return current;
      const revealed = current.revealed.includes(currentQuestion.id)
        ? current.revealed.filter((value) => value !== currentQuestion.id)
        : [...current.revealed, currentQuestion.id];
      return { ...current, revealed };
    });
  };

  const handleBookmark = async () => {
    if (!currentQuestion || !session) return;
    try {
      const next = await toggleBookmark(currentQuestion, isBookmarked);
      setSession((current) => {
        if (!current) return current;
        const bookmarked = next
          ? [...new Set([...current.bookmarked, currentQuestion.id])]
          : current.bookmarked.filter((value) => value !== currentQuestion.id);
        return { ...current, bookmarked };
      });
      toast.success(
        next ? 'Question bookmarked' : 'Bookmark removed',
        next
          ? 'Find it later in your bookmark library.'
          : 'This question was removed from your saved set.',
      );
    } catch {
      toast.error('Bookmark could not be updated', 'Please check your connection.');
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2]">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-6 w-6 text-brand-600" />
          <p className="text-sm font-semibold text-ink-500">Preparing your test…</p>
        </div>
      </div>
    );
  }

  if (notFound || !session || !currentQuestion) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f6f2] px-6 text-center">
        <LogoMark className="h-14 w-14" />
        <h1 className="mt-5 font-display text-3xl font-medium text-ink-950">
          This test session is no longer active
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">
          It may have been finished, cleared, or opened in another tab. You can build a
          fresh test in seconds.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/practice" className="btn-brand">
            Build a new test
          </Link>
          <Link to="/" className="btn-secondary">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const test = session.test;
  const progress = totalQuestions ? (answeredCount / totalQuestions) * 100 : 0;
  const remainingLow = remaining <= 60;
  const remainingMedium = remaining <= 300;
  const readingQuestionCount = questions.filter(
    (question) => question.section === 'reading',
  ).length;
  const grammarQuestionCount = totalQuestions - readingQuestionCount;
  const groups = groupQuestions(test.questions);
  const groupIndex = currentGroup
    ? groups.findIndex((group) => group.key === currentGroup.key)
    : -1;
  const isReading = currentQuestion.section === 'reading';
  const atLast = currentIndex === totalQuestions - 1;

  return (
    <div className="min-h-screen bg-[#f7f6f2]">
      {/* Test header */}
      <header className="sticky top-0 z-50 border-b border-ink-200/70 bg-[#f7f6f2]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-2 px-3 sm:gap-3 sm:px-5">
          <button
            type="button"
            onClick={() => setShowExit(true)}
            className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-ink-100"
            aria-label="Leave test"
          >
            <LogoMark className="h-9 w-9" />
            <span className="hidden flex-col items-start leading-none lg:flex">
              <span className="text-[11px] font-extrabold tracking-[0.14em] text-ink-950">
                STEPWISE
              </span>
              <span className="mt-1 max-w-[170px] truncate text-[9px] font-bold uppercase tracking-wide text-ink-400">
                {test.config.label}
              </span>
            </span>
          </button>

          <div className="ml-1 hidden min-w-0 flex-1 sm:block">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-ink-400">
              <span>
                {answeredCount}/{totalQuestions} answered
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-200/70">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {session.untimed ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs font-bold text-ink-500">
                <TimerReset className="h-3.5 w-3.5" />
                <span>Untimed</span>
              </span>
            ) : (
              <span
                role="timer"
                aria-live="off"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-extrabold tabular-nums transition-colors sm:text-sm',
                  remainingLow
                    ? 'animate-pulse border-rose-200 bg-rose-50 text-rose-600'
                    : remainingMedium
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-ink-200 bg-white text-ink-800',
                )}
                aria-label={`${formatClock(remaining)} remaining`}
              >
                <Clock className="h-3.5 w-3.5" />
                {formatClock(remaining)}
              </span>
            )}

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs font-bold text-ink-700 transition hover:border-ink-300 hover:bg-ink-50"
            >
              <Grid3X3 className="h-4 w-4" />
              <span className="hidden md:inline">Question map</span>
              <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500 md:hidden">
                {answeredCount}/{totalQuestions}
              </span>
            </button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowFinish(true)}
              className="px-3 py-2 sm:px-4"
            >
              <Flag className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Finish</span>
              <span className="sm:hidden">End</span>
            </Button>
          </div>
        </div>
        <div className="h-0.5 w-full bg-ink-200/60 sm:hidden">
          <div
            className="h-full bg-brand-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-5 sm:py-6">
        {isReading ? (
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileTab('passage')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition',
                mobileTab === 'passage'
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-ink-500',
              )}
            >
              <BookOpen className="h-3.5 w-3.5" /> Reading passage
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('question')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition',
                mobileTab === 'question'
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-ink-500',
              )}
            >
              <PenLine className="h-3.5 w-3.5" /> Question
            </button>
          </div>
        ) : null}

        <div
          className={cn(
            isReading
              ? 'grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:gap-5'
              : 'mx-auto max-w-3xl',
          )}
        >
          {isReading ? (
            <div
              className={cn(
                'min-w-0',
                mobileTab === 'passage' ? 'block' : 'hidden lg:block',
              )}
            >
              <aside className="lg:sticky lg:top-[84px]">
                <div className="surface flex flex-col overflow-hidden lg:max-h-[calc(100vh-104px)]">
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-200/70 px-4 py-3.5 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <BookOpen className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold text-ink-900">
                          {currentQuestion.passage?.label || 'Reading passage'}
                          {currentQuestion.passage?.title &&
                          currentQuestion.passage.title !==
                            currentQuestion.passage.label
                            ? ` · ${currentQuestion.passage.title}`
                            : ''}
                        </p>
                        <p className="text-[10px] font-semibold text-ink-400">
                          {groupIndex + 1} of {groups.filter((group) => group.section === 'reading').length}{' '}
                          reading passages · {currentGroup?.questions.length ?? 0}{' '}
                          {pluralize(currentGroup?.questions.length ?? 0, 'question')}
                        </p>
                      </div>
                    </div>
                    <span className="hidden shrink-0 rounded-full bg-ink-50 px-2 py-1 text-[10px] font-bold text-ink-400 sm:inline">
                      Stays in view
                    </span>
                  </div>
                  <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
                    <PassageText text={currentQuestion.passage?.text || ''} />
                  </div>
                  <div className="shrink-0 border-t border-ink-200/70 bg-ink-50/50 px-4 py-2.5 text-[10px] leading-relaxed text-ink-400 sm:px-5">
                    The passage stays fixed while you move through its questions.
                    {currentGroup ? (
                      <span className="font-semibold text-ink-500">
                        {' '}
                        Questions {currentGroup.startIndex + 1}–
                        {currentGroup.startIndex + currentGroup.questions.length}
                      </span>
                    ) : null}
                  </div>
                </div>
              </aside>
            </div>
          ) : null}

          <div
            className={cn(
              'min-w-0',
              isReading && mobileTab !== 'question' ? 'hidden lg:block' : 'block',
            )}
          >
            <section className="surface overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200/70 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <SectionPill section={currentQuestion.section} />
                  <span className="rounded-full bg-ink-50 px-2.5 py-1 text-[10px] font-bold text-ink-500">
                    {currentQuestion.modelTitle}
                  </span>
                  {currentQuestion.passage && isReading ? (
                    <span className="hidden rounded-full bg-ink-50 px-2.5 py-1 text-[10px] font-bold text-ink-400 sm:inline">
                      {currentQuestion.passage.label}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold text-ink-400">
                  <span className="tabular-nums">
                    Question <span className="text-ink-900">{currentIndex + 1}</span> of{' '}
                    {totalQuestions}
                  </span>
                  {isBookmarked ? (
                    <BookmarkCheck className="h-4 w-4 text-amber-500" />
                  ) : null}
                </div>
              </div>

              <div className="px-4 py-5 sm:px-6 sm:py-6">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">
                    {sectionLabel(currentQuestion.section)}
                  </span>
                  <span className="h-px flex-1 bg-ink-100" />
                  <span className="text-[10px] font-semibold text-ink-400">
                    Source Q{currentQuestion.sourceNumber}
                  </span>
                </div>

                <h1 className="mt-3 whitespace-pre-line text-pretty text-lg font-bold leading-relaxed text-ink-950 sm:text-xl">
                  {currentQuestion.text}
                </h1>

                <div className="mt-5 space-y-2.5" role="group" aria-label="Answer options">
                  {currentQuestion.options.map((option) => (
                    <OptionRow
                      key={option.label}
                      question={currentQuestion}
                      label={option.label}
                      text={option.text}
                      selected={selectedAnswer === option.label}
                      revealed={isRevealed}
                      onSelect={() => selectAnswer(option.label)}
                    />
                  ))}
                </div>

                {isRevealed ? (
                  <div
                    className={cn(
                      'mt-4 flex items-start gap-3 rounded-2xl border p-3.5 text-sm',
                      selectedAnswer === currentQuestion.correctAnswer
                        ? 'border-mint-200 bg-mint-50 text-mint-900'
                        : 'border-rose-200 bg-rose-50 text-rose-900',
                    )}
                    role="status"
                  >
                    {selectedAnswer === currentQuestion.correctAnswer ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                    )}
                    <div>
                      <p className="font-bold">
                        {selectedAnswer === currentQuestion.correctAnswer
                          ? 'Correct answer'
                          : selectedAnswer
                            ? 'Not quite'
                            : 'Answer revealed'}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed opacity-80">
                        The correct choice is{' '}
                        <strong>
                          {currentQuestion.correctAnswer} ·{' '}
                          {
                            currentQuestion.options.find(
                              (option) =>
                                option.label === currentQuestion.correctAnswer,
                            )?.text
                          }
                        </strong>
                        {/^[.!?]/.test(
                          currentQuestion.options.find(
                            (option) => option.label === currentQuestion.correctAnswer,
                          )?.text.slice(-1) || '',
                        )
                          ? ''
                          : '.'}
                        {selectedAnswer && selectedAnswer !== currentQuestion.correctAnswer ? (
                          <>
                            {' '}
                            You chose {selectedAnswer}. Review the passage and how the
                            option is supported.
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                ) : null}

                <p className="mt-4 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-400">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  Revealing an answer locks your selection for this question. Choose your
                  own answer first for an honest score.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-ink-200/70 bg-ink-50/40 px-3 py-3 sm:px-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => goToQuestion(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className="px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>

                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleBookmark}
                    className={cn(
                      isBookmarked && 'border-amber-300 bg-amber-50 text-amber-800',
                    )}
                    aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
                  >
                    {isBookmarked ? (
                      <BookmarkCheck className="h-4 w-4" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                    <BilingualLabel
                      en={isBookmarked ? 'Bookmarked' : 'Bookmark'}
                      ar={isBookmarked ? 'محفوظ' : 'حفظ السؤال'}
                      className="hidden sm:flex"
                    />
                    <span className="sm:hidden">{isBookmarked ? 'Saved' : 'Save'}</span>
                  </Button>

                  <Button
                    variant={isRevealed ? 'secondary' : 'soft'}
                    size="sm"
                    onClick={toggleReveal}
                  >
                    {isRevealed ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    <BilingualLabel
                      en={isRevealed ? 'Hide answer' : 'Show answer'}
                      ar={isRevealed ? 'إخفاء الإجابة' : 'إظهار الإجابة'}
                      className="hidden sm:flex"
                    />
                    <span className="sm:hidden">{isRevealed ? 'Hide' : 'Answer'}</span>
                  </Button>

                  <Button
                    variant="brand"
                    size="sm"
                    onClick={() => {
                      if (atLast) setShowFinish(true);
                      else goToQuestion(currentIndex + 1);
                    }}
                    className="px-3.5"
                  >
                    <BilingualLabel
                      en={atLast ? 'Finish test' : 'Next question'}
                      ar={atLast ? 'إنهاء الاختبار' : 'السؤال التالي'}
                    />
                    {atLast ? (
                      <Flag className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </section>

            <div className="mt-2.5 flex items-center justify-between px-1 text-[10px] font-semibold text-ink-400">
              <span>
                {readingQuestionCount} reading · {grammarQuestionCount} grammar
              </span>
              <span className="hidden sm:inline">
                Answers save automatically on this device
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Question map drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-ink-950/45 backdrop-blur-[2px] animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close question map"
          />
          <aside
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-lift animate-fade-in"
            aria-label="Question map"
          >
            <div className="flex items-start justify-between border-b border-ink-200/70 px-5 py-4">
              <div>
                <p className="eyebrow">Navigate</p>
                <h2 className="mt-1 text-lg font-extrabold text-ink-950">Question map</h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 divide-x divide-ink-100 border-b border-ink-200/70">
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                  Answered
                </p>
                <p className="mt-0.5 text-lg font-extrabold text-ink-950">
                  {answeredCount}
                  <span className="text-xs font-bold text-ink-300">/{totalQuestions}</span>
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                  Bookmarked
                </p>
                <p className="mt-0.5 text-lg font-extrabold text-ink-950">
                  {bookmarkedCount}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                  Time left
                </p>
                <p className="mt-0.5 text-lg font-extrabold tabular-nums text-ink-950">
                  {session.untimed ? '—' : formatClock(remaining)}
                </p>
              </div>
            </div>

            <div className="scroll-slim flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-5">
                {groups.map((group) => (
                  <div key={group.key}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-ink-700">
                        {group.section === 'reading' ? (
                          <BookOpen className="h-3.5 w-3.5 text-brand-500" />
                        ) : (
                          <PenLine className="h-3.5 w-3.5 text-mint-500" />
                        )}
                        {group.section === 'reading'
                          ? group.title || group.label
                          : 'Grammar'}
                      </p>
                      <span className="text-[10px] font-semibold text-ink-400">
                        {group.startIndex + 1}–
                        {group.startIndex + group.questions.length}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-5 gap-1.5">
                      {group.questions.map((question, offset) => {
                        const index = group.startIndex + offset;
                        const isCurrent = index === currentIndex;
                        const answered = Boolean(session.answers[question.id]);
                        const bookmarked = session.bookmarked.includes(question.id);
                        return (
                          <button
                            key={question.id}
                            type="button"
                            onClick={() => goToQuestion(index)}
                            aria-label={`Question ${index + 1}${answered ? ', answered' : ', unanswered'}${bookmarked ? ', bookmarked' : ''}`}
                            aria-current={isCurrent ? 'step' : undefined}
                            className={cn(
                              'relative flex h-10 items-center justify-center rounded-lg border text-xs font-extrabold transition',
                              isCurrent
                                ? 'border-ink-950 bg-ink-950 text-white ring-2 ring-brand-400 ring-offset-1'
                                : answered
                                  ? 'border-ink-900 bg-ink-900 text-white hover:bg-ink-800'
                                  : 'border-ink-200 bg-white text-ink-500 hover:border-ink-300 hover:bg-ink-50',
                            )}
                          >
                            {index + 1}
                            {bookmarked ? (
                              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400 ring-1 ring-white/80" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 rounded-xl bg-ink-50 px-3 py-2.5 text-[10px] font-semibold text-ink-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-ink-900 bg-ink-900" />
                  Answered
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-ink-300 bg-white" />
                  Unanswered
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-brand-400 bg-ink-950 ring-1 ring-brand-300" />
                  Current
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Bookmarked
                </span>
              </div>
            </div>

            <div className="border-t border-ink-200/70 p-4">
              <Button
                variant="brand"
                className="w-full py-3"
                onClick={() => {
                  setDrawerOpen(false);
                  setShowFinish(true);
                }}
              >
                <Send className="h-4 w-4" />
                <BilingualLabel en="Finish test" ar="إنهاء الاختبار" />
              </Button>
              <p className="mt-2 text-center text-[10px] text-ink-400">
                Unanswered questions are marked incorrect.
              </p>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Finish confirmation */}
      <ConfirmDialog
        open={showFinish}
        onClose={() => setShowFinish(false)}
        onConfirm={() => void finishTest(false)}
        title="Finish this test?"
        description={
          answeredCount === totalQuestions
            ? 'All questions are answered. Your test will be scored and saved for review.'
            : `${totalQuestions - answeredCount} ${pluralize(totalQuestions - answeredCount, 'question')} ${totalQuestions - answeredCount === 1 ? 'is' : 'are'} still unanswered and will be marked incorrect.`
        }
        confirmLabel="Finish & see results"
        cancelLabel="Keep practicing"
        busy={submitting}
        icon={
          <>
            <Clock className="h-4 w-4 shrink-0 text-ink-400" />
            <span>
              {session.untimed
                ? 'Untimed practice — your duration is still recorded.'
                : `${formatClock(remaining)} remaining on the clock.`}
            </span>
          </>
        }
      />

      {/* Exit confirmation */}
      <ConfirmDialog
        open={showExit}
        onClose={() => setShowExit(false)}
        onConfirm={() => {
          setShowExit(false);
          navigate('/');
        }}
        title="Leave the test?"
        description={
          session.untimed
            ? 'Your progress is saved in this browser. You can resume from the dashboard whenever you are ready.'
            : 'Your progress is saved, but the countdown keeps running while you are away. Resume from the dashboard to continue.'
        }
        confirmLabel="Save & leave"
        cancelLabel="Stay in test"
        tone="primary"
        icon={
          <>
            <LogOut className="h-4 w-4 shrink-0 text-ink-400" />
            <span>Resume any active test from the dashboard.</span>
          </>
        }
      />

      {submitting ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#f7f6f2]/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-lift">
            <Spinner className="h-6 w-6 text-brand-600" />
            <p className="text-sm font-extrabold text-ink-900">Scoring your test…</p>
            <p className="text-[11px] text-ink-400">Building your answer review</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
