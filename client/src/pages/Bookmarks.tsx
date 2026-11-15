import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Layers,
  LogIn,
  PenLine,
  Play,
  Search,
  Target,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../lib/api';
import {
  formatDate,
  pluralize,
  sectionLabel,
  cn,
} from '../lib/format';
import { loadBookmarks, removeBookmark } from '../lib/results';
import { saveActiveSession } from '../lib/storage';
import type { ActiveTestSession, BookmarkRecord, Section } from '../types';
import { PassageText } from '../components/PassageText';
import {
  BilingualLabel,
  Button,
  EmptyState,
  InlineAlert,
  PageHeader,
  SectionPill,
  Spinner,
  StatCard,
} from '../components/ui';

type BookmarkFilter = 'all' | Section;

function BookmarkCard({
  bookmark,
  onPractice,
  onRemove,
  practicing,
  removing,
}: {
  bookmark: BookmarkRecord;
  onPractice: () => void;
  onRemove: () => void;
  practicing: boolean;
  removing: boolean;
}) {
  const snapshot = bookmark.snapshot;
  return (
    <article className="surface flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-2 border-b border-ink-200/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Bookmark className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <SectionPill section={snapshot.section} />
              <span className="rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-bold text-ink-500">
                {snapshot.modelTitle}
              </span>
              <span className="text-[10px] font-semibold text-ink-400">
                Q{snapshot.number}
              </span>
            </div>
            <p className="mt-1 text-[10px] font-semibold text-ink-400">
              Saved {formatDate(bookmark.createdAt, false)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="rounded-lg p-1.5 text-ink-300 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
          aria-label="Remove bookmark"
        >
          {removing ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 px-4 py-4">
        <p className="whitespace-pre-line text-[15px] font-bold leading-relaxed text-ink-900">
          {snapshot.text}
        </p>

        <div className="mt-3 space-y-1.5">
          {snapshot.options.map((option) => {
            const correct = option.label === snapshot.correctAnswer;
            return (
              <div
                key={option.label}
                className={cn(
                  'flex items-start gap-2.5 rounded-xl border px-2.5 py-2 text-xs leading-relaxed',
                  correct
                    ? 'border-mint-300 bg-mint-50/70 text-ink-800'
                    : 'border-ink-200 bg-white text-ink-600',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold',
                    correct ? 'bg-mint-600 text-white' : 'bg-ink-100 text-ink-500',
                  )}
                >
                  {option.label}
                </span>
                <span className="min-w-0 flex-1">{option.text}</span>
                {correct ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" />
                ) : null}
              </div>
            );
          })}
        </div>

        {snapshot.passage ? (
          <details className="group mt-3 rounded-xl border border-ink-200 bg-ink-50/50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold text-ink-600 transition hover:text-ink-900">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-brand-500" />
                Reading passage · {snapshot.passage.label}
              </span>
              <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
            </summary>
            <div className="max-h-80 overflow-y-auto border-t border-ink-200/70 bg-white px-4 py-4 scroll-slim">
              <PassageText text={snapshot.passage.text} compact />
            </div>
          </details>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-ink-200/70 bg-ink-50/40 px-4 py-2.5">
        <Button variant="soft" size="sm" onClick={onPractice} loading={practicing}>
          {!practicing ? <Play className="h-3.5 w-3.5" /> : null}
          Practice this question
        </Button>
        <span className="ml-auto text-[10px] font-semibold text-ink-400">
          {sectionLabel(snapshot.section)} · {snapshot.modelTitle}
        </span>
      </div>
    </article>
  );
}

export default function Bookmarks() {
  const { isGuest, user, ready } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [filter, setFilter] = useState<BookmarkFilter>('all');
  const [search, setSearch] = useState('');
  const [practicing, setPracticing] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    setLoadError(null);

    loadBookmarks()
      .then((loaded) => {
        if (active) setBookmarks(loaded);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'Bookmarks could not be loaded. Check your connection and try again.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ready, user?.id, isGuest, retryKey]);

  const counts = useMemo(
    () => ({
      all: bookmarks.length,
      reading: bookmarks.filter((bookmark) => bookmark.section === 'reading').length,
      grammar: bookmarks.filter((bookmark) => bookmark.section === 'grammar').length,
      models: new Set(bookmarks.map((bookmark) => bookmark.modelId)).size,
    }),
    [bookmarks],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bookmarks.filter((bookmark) => {
      if (filter !== 'all' && bookmark.section !== filter) return false;
      if (!term) return true;
      return (
        bookmark.snapshot.text.toLowerCase().includes(term) ||
        bookmark.snapshot.modelTitle.toLowerCase().includes(term) ||
        (bookmark.snapshot.passage?.text || '').toLowerCase().includes(term)
      );
    });
  }, [bookmarks, filter, search]);

  const startPractice = async (ids: string[], key: string) => {
    if (!ids.length) return;
    setPracticing(key);
    try {
      const { test } = await api.generateTest({
        questionIds: ids,
        secondsPerQuestion: 60,
      });
      if (!test.questions.length) {
        toast.error(
          'Nothing to practice',
          'These bookmarked questions are no longer available in the bank.',
        );
        return;
      }
      const session: ActiveTestSession = {
        test,
        answers: {},
        revealed: [],
        bookmarked: ids,
        currentIndex: 0,
        deadline: Date.now() + test.totalSeconds * 1000,
        startedAt: new Date().toISOString(),
        untimed: false,
      };
      saveActiveSession(session);
      navigate(`/test/${test.id}`);
    } catch (error) {
      toast.error(
        'Could not start practice',
        error instanceof ApiError ? error.message : 'Please try again.',
      );
    } finally {
      setPracticing(null);
    }
  };

  const handleRemove = async (bookmark: BookmarkRecord) => {
    setRemovingId(bookmark.questionId);
    try {
      await removeBookmark(bookmark.questionId);
      setBookmarks((current) =>
        current.filter((item) => item.questionId !== bookmark.questionId),
      );
      toast.success('Bookmark removed', 'The question was removed from your library.');
    } catch (error) {
      toast.error(
        'Could not remove bookmark',
        error instanceof ApiError ? error.message : 'Please try again.',
      );
    } finally {
      setRemovingId(null);
    }
  };

  const practiceAllIds = bookmarks.map((bookmark) => bookmark.questionId);
  const practiceVisibleIds = filtered.map((bookmark) => bookmark.questionId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Review library"
        title="Saved questions"
        description="A personal set of questions worth another look. Practice them together or open the passage when you need context."
        action={
          <Button
            variant="brand"
            onClick={() => startPractice(practiceAllIds, 'all')}
            loading={practicing === 'all'}
            disabled={!bookmarks.length}
          >
            {practicing !== 'all' ? <Play className="h-4 w-4" /> : null}
            <BilingualLabel en="Practice all" ar="تدرب على الكل" />
          </Button>
        }
      />

      {isGuest ? (
        <div className="surface flex flex-col gap-3 border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Cloud className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink-900">Guest bookmarks</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                Bookmarks are stored in this browser. Sign in to keep them forever and
                practice them on any device.
              </p>
            </div>
          </div>
          <Link to="/auth" className="btn-secondary btn-sm shrink-0">
            <LogIn className="h-4 w-4" /> Sync bookmarks
          </Link>
        </div>
      ) : null}

      {loadError ? (
        <InlineAlert tone="warn" title="Bookmarks unavailable">
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

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Bookmark stats">
        <StatCard
          label="Saved questions"
          value={counts.all}
          detail="Across your review library"
          icon={<Bookmark className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Reading"
          value={counts.reading}
          detail="Passage-based questions"
          icon={<BookOpen className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Grammar"
          value={counts.grammar}
          detail="Sentence and usage items"
          icon={<PenLine className="h-5 w-5" />}
          accent="mint"
        />
        <StatCard
          label="Models covered"
          value={counts.models}
          detail="Source variety in your set"
          icon={<Target className="h-5 w-5" />}
          accent="ink"
        />
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ink-200/70 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl bg-ink-100/70 p-1">
            {(
              [
                { key: 'all', label: `All (${counts.all})`, icon: Layers },
                { key: 'reading', label: `Reading (${counts.reading})`, icon: BookOpen },
                { key: 'grammar', label: `Grammar (${counts.grammar})`, icon: PenLine },
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

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search saved questions…"
                className="input h-9 py-1.5 pl-8 text-xs"
                aria-label="Search bookmarks"
              />
            </div>
            <Button
              variant="soft"
              size="sm"
              onClick={() => startPractice(practiceVisibleIds, 'visible')}
              loading={practicing === 'visible'}
              disabled={!practiceVisibleIds.length}
              className="shrink-0"
            >
              {practicing !== 'visible' ? <Play className="h-3.5 w-3.5" /> : null}
              Practice these ({practiceVisibleIds.length})
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner className="h-5 w-5 text-brand-600" />
            <p className="mt-2 text-xs font-semibold text-ink-400">
              Loading your saved questions…
            </p>
          </div>
        ) : filtered.length ? (
          <div className="grid gap-4 bg-ink-50/30 p-3 sm:p-4 xl:grid-cols-2">
            {filtered.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                onPractice={() =>
                  startPractice([bookmark.questionId], bookmark.questionId)
                }
                onRemove={() => handleRemove(bookmark)}
                practicing={practicing === bookmark.questionId}
                removing={removingId === bookmark.questionId}
              />
            ))}
          </div>
        ) : bookmarks.length ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-bold text-ink-900">No saved questions match</p>
            <p className="mt-1 text-xs text-ink-500">
              Try a different filter or search term.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => {
                setFilter('all');
                setSearch('');
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="px-5 py-4">
            <EmptyState
              icon={<Bookmark className="h-6 w-6" />}
              title="No saved questions yet"
              description="While practicing, tap Bookmark on any question. After a test you can also save every mistake at once from the results page."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link to="/practice" className="btn-brand">
                    <Play className="h-4 w-4" /> Practice and bookmark
                  </Link>
                  <Link to="/history" className="btn-secondary">
                    Review a past test
                  </Link>
                </div>
              }
              className="border-0 bg-transparent shadow-none"
            />
          </div>
        )}
      </section>

      {filtered.length ? (
        <p className="text-center text-[11px] text-ink-400">
          {filtered.length} of {bookmarks.length}{' '}
          {pluralize(bookmarks.length, 'saved question')} shown. Bookmarks stay attached to
          their original passage.
        </p>
      ) : null}
    </div>
  );
}
