import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookmarkPlus,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  History,
  ListChecks,
  Play,
  PenLine,
  RotateCcw,
  Sparkles,
  Target,
  Timer,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../lib/api';
import {
  formatDate,
  formatDuration,
  pluralize,
  scoreMessage,
  scoreTone,
  sectionLabel,
  cn,
} from '../lib/format';
import {
  loadTestById,
  saveMistakesToBookmarks,
} from '../lib/results';
import { saveActiveSession } from '../lib/storage';
import type {
  ActiveTestSession,
  GenerateTestInput,
  ReviewedQuestion,
  ReviewedTest,
  Section,
} from '../types';
import { PassageText } from '../components/PassageText';
import {
  BilingualLabel,
  Button,
  EmptyState,
  InlineAlert,
  ProgressBar,
  ScoreRing,
  SectionPill,
  Spinner,
} from '../components/ui';

type ReviewFilter = 'all' | 'wrong' | 'unanswered';

function ReviewOption({
  label,
  text,
  correct,
  selected,
}: {
  label: string;
  text: string;
  correct: boolean;
  selected: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 text-sm',
        correct
          ? 'border-mint-300 bg-mint-50/70'
          : selected
            ? 'border-rose-300 bg-rose-50/70'
            : 'border-ink-200 bg-white',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold',
          correct
            ? 'bg-mint-600 text-white'
            : selected
              ? 'bg-rose-600 text-white'
              : 'bg-ink-100 text-ink-500',
        )}
      >
        {label}
      </span>
      <span className="min-w-0 flex-1 leading-relaxed text-ink-800">{text}</span>
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        {correct ? (
          <CheckCircle2 className="h-5 w-5 text-mint-600" />
        ) : selected ? (
          <XCircle className="h-5 w-5 text-rose-600" />
        ) : null}
      </span>
    </div>
  );
}

function ReviewQuestionCard({
  question,
  number,
}: {
  question: ReviewedQuestion;
  number: number;
}) {
  const [open, setOpen] = useState(!question.isCorrect);
  const status = question.isCorrect
    ? 'correct'
    : question.userAnswer
      ? 'incorrect'
      : 'unanswered';

  return (
    <article className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200/70 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-950 text-[11px] font-extrabold text-white">
            {number}
          </span>
          <SectionPill section={question.section} />
          <span className="rounded-full bg-ink-50 px-2.5 py-1 text-[10px] font-bold text-ink-500">
            {question.modelTitle}
          </span>
          {question.passage ? (
            <span className="hidden rounded-full bg-ink-50 px-2.5 py-1 text-[10px] font-bold text-ink-400 sm:inline">
              {question.passage.label}
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold',
            status === 'correct'
              ? 'bg-mint-50 text-mint-700'
              : status === 'incorrect'
                ? 'bg-rose-50 text-rose-600'
                : 'bg-amber-50 text-amber-700',
          )}
        >
          {status === 'correct' ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : status === 'incorrect' ? (
            <XCircle className="h-3 w-3" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
          {status === 'correct' ? 'Correct' : status === 'incorrect' ? 'Incorrect' : 'Not answered'}
        </span>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-start justify-between gap-3 text-left"
          aria-expanded={open}
        >
          <p className="whitespace-pre-line text-pretty text-[15px] font-bold leading-relaxed text-ink-900">
            {question.text}
          </p>
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-400 transition hover:bg-ink-50">
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
            />
          </span>
        </button>

        {!open ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-ink-500">
            <span>
              Your answer:{' '}
              <strong className={question.userAnswer ? 'text-ink-800' : 'text-amber-700'}>
                {question.userAnswer || 'Not answered'}
              </strong>
            </span>
            <span>
              Correct answer:{' '}
              <strong className="text-mint-700">{question.correctAnswer}</strong>
            </span>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {question.options.map((option) => (
              <ReviewOption
                key={option.label}
                label={option.label}
                text={option.text}
                correct={option.label === question.correctAnswer}
                selected={option.label === question.userAnswer}
              />
            ))}

            {question.passage ? (
              <details className="group mt-3 rounded-xl border border-ink-200 bg-ink-50/50">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold text-ink-600 transition hover:text-ink-900">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-brand-500" />
                    Reading passage · {question.passage.label}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-ink-200/70 bg-white px-4 py-4">
                  <PassageText text={question.passage.text} compact />
                </div>
              </details>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [test, setTest] = useState<ReviewedTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [savingMistakes, setSavingMistakes] = useState(false);
  const [retaking, setRetaking] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setLoadError(null);

    loadTestById(id)
      .then((loaded) => {
        if (active) setTest(loaded);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'The result could not be loaded. Check your connection and try again.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, retryKey]);

  const sectionStats = useMemo(() => {
    if (!test) return [];
    return (['reading', 'grammar'] as Section[])
      .map((section) => {
        const questions = test.questions.filter(
          (question) => question.section === section,
        );
        const correct = questions.filter((question) => question.isCorrect).length;
        return {
          section,
          total: questions.length,
          correct,
          percent: questions.length
            ? Math.round((correct / questions.length) * 100)
            : 0,
        };
      })
      .filter((item) => item.total > 0);
  }, [test]);

  const wrongQuestions = useMemo(
    () => test?.questions.filter((question) => !question.isCorrect) ?? [],
    [test],
  );
  const incorrectQuestions = useMemo(
    () =>
      test?.questions.filter(
        (question) => Boolean(question.userAnswer) && !question.isCorrect,
      ) ?? [],
    [test],
  );
  const unanswered = useMemo(
    () => test?.questions.filter((question) => !question.userAnswer) ?? [],
    [test],
  );

  const filteredQuestions = useMemo(() => {
    if (!test) return [];
    return test.questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => {
        if (filter === 'wrong') {
          return Boolean(question.userAnswer) && !question.isCorrect;
        }
        if (filter === 'unanswered') return !question.userAnswer;
        return true;
      });
  }, [test, filter]);

  const handleSaveMistakes = async () => {
    if (!test || !wrongQuestions.length) return;
    setSavingMistakes(true);
    try {
      const result = await saveMistakesToBookmarks(test);
      if (result.saved === result.total) {
        toast.success(
          'Mistakes saved to bookmarks',
          `${result.saved} ${pluralize(result.saved, 'question')} added to your review library.`,
        );
      } else {
        toast.error(
          'Some mistakes could not be saved',
          `${result.saved} of ${result.total} questions were bookmarked. Please try again.`,
        );
      }
    } catch {
      toast.error(
        'Could not save mistakes',
        'Check your connection and try again in a moment.',
      );
    } finally {
      setSavingMistakes(false);
    }
  };

  const handleRetake = async () => {
    if (!test) return;
    setRetaking(true);
    try {
      const bookmarkedRetake =
        test.config.label === 'Bookmarked questions' || !test.config.modelIds.length;
      const input: GenerateTestInput = bookmarkedRetake
        ? {
            questionIds: test.questions.map((question) => question.id),
            secondsPerQuestion: test.config.secondsPerQuestion || 60,
          }
        : {
            modelIds: test.config.modelIds,
            sections: test.config.sections,
            readingCount: test.config.readingCount,
            grammarCount: test.config.grammarCount,
            secondsPerQuestion: test.config.secondsPerQuestion || 60,
          };

      const { test: nextTest } = await api.generateTest(input);
      if (!nextTest.questions.length) {
        toast.error('Nothing to retake', 'These questions are no longer playable.');
        return;
      }
      const session: ActiveTestSession = {
        test: nextTest,
        answers: {},
        revealed: [],
        bookmarked: [],
        currentIndex: 0,
        deadline: Date.now() + nextTest.totalSeconds * 1000,
        startedAt: new Date().toISOString(),
        untimed: false,
      };
      saveActiveSession(session);
      navigate(`/test/${nextTest.id}`);
    } catch (error) {
      toast.error(
        'Could not start the retake',
        error instanceof ApiError ? error.message : 'Please try again.',
      );
    } finally {
      setRetaking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Spinner className="h-6 w-6 text-brand-600" />
        <p className="mt-3 text-sm font-semibold text-ink-500">Loading your results…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <InlineAlert tone="warn" title="Results unavailable">
          {loadError}
        </InlineAlert>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => setRetryKey((value) => value + 1)}>
            Try again
          </Button>
          <Link to="/history" className="btn-secondary">
            View history
          </Link>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <EmptyState
        icon={<History className="h-6 w-6" />}
        title="That result was not found"
        description="It may have been deleted or saved under a different account. Your other attempts are waiting in history."
        action={
          <div className="flex gap-2">
            <Link to="/history" className="btn-secondary">
              Open history
            </Link>
            <Link to="/practice" className="btn-brand">
              Start a new test
            </Link>
          </div>
        }
      />
    );
  }

  const tone = scoreTone(test.score);
  const answeredPercent = test.totalCount
    ? Math.round((test.answeredCount / test.totalCount) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <Link
        to="/history"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-500 transition hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to history
      </Link>

      <section className="relative overflow-hidden rounded-[1.75rem] bg-ink-950 px-5 py-6 text-white shadow-lift sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.16]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-mint-500/15 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-300">
              <span className="h-px w-6 bg-brand-400/70" />
              Test complete · {formatDate(test.completedAt)}
            </p>
            <h1 className="mt-3 text-balance font-display text-3xl font-medium leading-[1.1] tracking-tight sm:text-[2.6rem]">
              {scoreMessage(test.score)}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-ink-300">
              <span>{test.config.label}</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(test.durationSeconds)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" />
                {test.correctCount} of {test.totalCount} correct
              </span>
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="brand" onClick={handleRetake} loading={retaking}>
                <RotateCcw className="h-4 w-4" />
                <BilingualLabel en="Retake this test" ar="إعادة الاختبار" />
              </Button>
              <Button
                variant="secondary"
                onClick={handleSaveMistakes}
                disabled={!wrongQuestions.length}
                loading={savingMistakes}
                className="border-white/15 bg-white/10 text-white hover:bg-white/15"
              >
                <BookmarkPlus className="h-4 w-4" />
                <BilingualLabel
                  en={`Save all mistakes${wrongQuestions.length ? ` (${wrongQuestions.length})` : ''}`}
                  ar="حفظ جميع الأخطاء"
                />
              </Button>
              <Link
                to="/"
                className="btn border border-white/10 text-ink-300 hover:bg-white/10 hover:text-white"
              >
                Dashboard
              </Link>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-5 lg:flex-col">
            <div className="rounded-full bg-white p-2.5 shadow-lift">
              <ScoreRing score={test.score} size={148} stroke={10} />
            </div>
            <div className="lg:text-center">
              <span
                className={cn(
                  'inline-flex rounded-full px-3 py-1 text-xs font-extrabold',
                  test.score >= 80
                    ? 'bg-mint-400/15 text-mint-300'
                    : test.score >= 60
                      ? 'bg-amber-400/15 text-amber-300'
                      : 'bg-rose-400/15 text-rose-300',
                )}
              >
                {tone.label}
              </span>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                {answeredPercent}% attempted
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
          {[
            {
              label: 'Correct',
              value: `${test.correctCount}/${test.totalCount}`,
              icon: <CheckCircle2 className="h-4 w-4 text-mint-400" />,
            },
            {
              label: 'Answered',
              value: `${test.answeredCount}/${test.totalCount}`,
              icon: <ListChecks className="h-4 w-4 text-brand-300" />,
            },
            {
              label: 'Duration',
              value: formatDuration(test.durationSeconds),
              icon: <Timer className="h-4 w-4 text-ink-300" />,
            },
            {
              label: 'Mistakes',
              value: String(wrongQuestions.length),
              icon: <Sparkles className="h-4 w-4 text-amber-300" />,
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-white/[0.06] px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-400">
                {item.icon}
                {item.label}
              </p>
              <p className="mt-1 text-base font-extrabold tabular-nums text-white">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {sectionStats.length ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {sectionStats.map((stat) => (
            <div key={stat.section} className="surface p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-extrabold text-ink-900">
                  {stat.section === 'reading' ? (
                    <BookOpen className="h-4 w-4 text-brand-500" />
                  ) : (
                    <PenLine className="h-4 w-4 text-mint-500" />
                  )}
                  {sectionLabel(stat.section)}
                </span>
                <span className="text-lg font-extrabold tabular-nums text-ink-900">
                  {stat.percent}%
                </span>
              </div>
              <ProgressBar
                value={stat.percent}
                className="mt-3"
                barClassName={stat.section === 'reading' ? 'bg-brand-500' : 'bg-mint-500'}
              />
              <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-ink-400">
                <span>
                  {stat.correct} of {stat.total} correct
                </span>
                <span>
                  {stat.total - stat.correct} {pluralize(stat.total - stat.correct, 'miss')}
                </span>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-ink-200 bg-white p-1 shadow-sm">
          {(
            [
              { key: 'all', label: `All questions (${test.totalCount})` },
              { key: 'wrong', label: `Incorrect (${incorrectQuestions.length})` },
              { key: 'unanswered', label: `Unanswered (${unanswered.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition',
                filter === item.key
                  ? 'bg-ink-950 text-white'
                  : 'text-ink-500 hover:bg-ink-50 hover:text-ink-900',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-ink-400">
            {filteredQuestions.length} shown
          </span>
          <Link to="/bookmarks" className="btn-secondary btn-sm">
            <BookmarkPlus className="h-3.5 w-3.5" />
            Bookmarks
          </Link>
        </div>
      </div>

      {filteredQuestions.length ? (
        <div className="space-y-3">
          {filteredQuestions.map(({ question, index }) => (
            <ReviewQuestionCard
              key={question.id}
              question={question}
              number={index + 1}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title={
            filter === 'wrong'
              ? 'No incorrect answers'
              : filter === 'unanswered'
                ? 'Every question was answered'
                : 'No questions to review'
          }
          description={
            filter === 'wrong'
              ? unanswered.length
                ? `Nothing was answered incorrectly. ${unanswered.length} ${pluralize(unanswered.length, 'question')} left blank — review them below.`
                : 'A flawless run. Retake the test later or try a harder mix of models.'
              : filter === 'unanswered'
                ? 'You left nothing blank — a good habit for test day.'
                : 'This attempt does not contain any reviewable questions.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => setFilter('all')}>
                Show all questions
              </Button>
              <Button variant="brand" onClick={handleRetake} loading={retaking}>
                <Play className="h-4 w-4" /> Retake
              </Button>
            </div>
          }
        />
      )}
    </div>
  );
}
