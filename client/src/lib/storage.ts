import type {
  ActiveTestSession,
  BookmarkRecord,
  BookmarkSnapshot,
  ReviewedTest,
  TestQuestion,
  TestSummary,
  PublicUser,
} from '../types';

const PREFIX = 'stepwise';
export const STORAGE_KEYS = {
  auth: `${PREFIX}.auth.v1`,
  history: `${PREFIX}.history.v1`,
  bookmarks: `${PREFIX}.bookmarks.v1`,
  activeTest: `${PREFIX}.active-test.v1`,
  preferences: `${PREFIX}.preferences.v1`,
} as const;

const RESULT_PREFIX = `${PREFIX}.result.v1.`;
const MAX_GUEST_TESTS = 120;

export interface StoredAuth {
  token: string;
  user: PublicUser;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private mode or when the quota is full.
  }
}

export function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

/* ── Auth ─────────────────────────────────────────────────────── */

export function getStoredAuth(): StoredAuth | null {
  const value = readJson<StoredAuth | null>(STORAGE_KEYS.auth, null);
  if (!value?.token || !value.user) return null;
  return value;
}

export function setStoredAuth(auth: StoredAuth) {
  writeJson(STORAGE_KEYS.auth, auth);
}

export function clearStoredAuth() {
  removeKey(STORAGE_KEYS.auth);
}

export function getStoredToken(): string | null {
  return getStoredAuth()?.token ?? null;
}

/* ── Guest test history ───────────────────────────────────────── */

export function getLocalHistory(): ReviewedTest[] {
  const tests = readJson<ReviewedTest[]>(STORAGE_KEYS.history, []);
  if (!Array.isArray(tests)) return [];
  return tests.sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
}

export function getLocalSummaries(): TestSummary[] {
  return getLocalHistory().map(({ questions: _questions, ...summary }) => summary);
}

export function getLocalTest(id: string): ReviewedTest | null {
  return getLocalHistory().find((test) => test.id === id) ?? null;
}

export function saveLocalTest(test: ReviewedTest): ReviewedTest {
  const tests = getLocalHistory().filter((item) => item.id !== test.id);
  tests.unshift(test);
  writeJson(STORAGE_KEYS.history, tests.slice(0, MAX_GUEST_TESTS));
  return test;
}

export function deleteLocalTest(id: string): boolean {
  const tests = getLocalHistory();
  const next = tests.filter((test) => test.id !== id);
  if (next.length === tests.length) return false;
  writeJson(STORAGE_KEYS.history, next);
  return true;
}

export function clearLocalHistory() {
  removeKey(STORAGE_KEYS.history);
}

/* ── Guest bookmarks ──────────────────────────────────────────── */

export function getLocalBookmarks(): BookmarkRecord[] {
  const bookmarks = readJson<BookmarkRecord[]>(STORAGE_KEYS.bookmarks, []);
  if (!Array.isArray(bookmarks)) return [];
  return bookmarks.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function isLocallyBookmarked(questionId: string): boolean {
  return getLocalBookmarks().some((bookmark) => bookmark.questionId === questionId);
}

function snapshotForQuestion(question: TestQuestion): BookmarkSnapshot {
  return {
    questionId: question.id,
    number: question.number,
    section: question.section,
    modelId: question.modelId,
    modelTitle: question.modelTitle,
    text: question.text,
    options: question.options,
    correctAnswer: question.correctAnswer,
    passage: question.passage,
  };
}

export function toBookmarkSnapshot(question: TestQuestion): BookmarkSnapshot {
  return snapshotForQuestion(question);
}

export function addLocalBookmark(
  question: TestQuestion | BookmarkSnapshot,
): BookmarkRecord {
  const snapshot =
    'questionId' in question ? question : toBookmarkSnapshot(question);
  const existing = getLocalBookmarks().find(
    (bookmark) => bookmark.questionId === snapshot.questionId,
  );
  if (existing) return existing;

  const bookmark: BookmarkRecord = {
    id: `local-bm-${crypto.randomUUID()}`,
    questionId: snapshot.questionId,
    modelId: snapshot.modelId,
    section: snapshot.section,
    snapshot,
    createdAt: new Date().toISOString(),
  };
  writeJson(STORAGE_KEYS.bookmarks, [bookmark, ...getLocalBookmarks()]);
  return bookmark;
}

export function removeLocalBookmark(questionId: string): boolean {
  const bookmarks = getLocalBookmarks();
  const next = bookmarks.filter((bookmark) => bookmark.questionId !== questionId);
  if (next.length === bookmarks.length) return false;
  writeJson(STORAGE_KEYS.bookmarks, next);
  return true;
}

export function clearLocalBookmarks() {
  removeKey(STORAGE_KEYS.bookmarks);
}

/* ── Active test session ──────────────────────────────────────── */

export function getActiveSession(): ActiveTestSession | null {
  const session = readJson<ActiveTestSession | null>(STORAGE_KEYS.activeTest, null);
  if (!session?.test?.questions?.length) return null;
  return session;
}

export function saveActiveSession(session: ActiveTestSession) {
  writeJson(STORAGE_KEYS.activeTest, session);
}

export function clearActiveSession() {
  removeKey(STORAGE_KEYS.activeTest);
}

/* ── Freshly completed results (tab-scoped) ───────────────────── */

export function cacheTestResult(test: ReviewedTest) {
  try {
    window.sessionStorage.setItem(`${RESULT_PREFIX}${test.id}`, JSON.stringify(test));
  } catch {
    // Ignore storage failures.
  }
}

export function getCachedTestResult(id: string): ReviewedTest | null {
  try {
    const raw = window.sessionStorage.getItem(`${RESULT_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as ReviewedTest;
  } catch {
    return null;
  }
}

export function removeCachedTestResult(id: string) {
  try {
    window.sessionStorage.removeItem(`${RESULT_PREFIX}${id}`);
  } catch {
    // Ignore storage failures.
  }
}

/* ── Preferences ──────────────────────────────────────────────── */

export interface Preferences {
  timerEnabled: boolean;
  secondsPerQuestion: number;
}

export function getPreferences(): Preferences {
  return readJson<Preferences>(STORAGE_KEYS.preferences, {
    timerEnabled: true,
    secondsPerQuestion: 60,
  });
}

export function savePreferences(preferences: Preferences) {
  writeJson(STORAGE_KEYS.preferences, preferences);
}

/* ── Migration helpers ────────────────────────────────────────── */

export function hasLocalData(): boolean {
  return getLocalHistory().length > 0 || getLocalBookmarks().length > 0;
}
