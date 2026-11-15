import { api, ApiError } from './api';
import {
  addLocalBookmark,
  cacheTestResult,
  clearLocalBookmarks,
  clearLocalHistory,
  deleteLocalTest,
  getCachedTestResult,
  getLocalBookmarks,
  getLocalHistory,
  getLocalSummaries,
  getLocalTest,
  getStoredToken,
  saveLocalTest,
  removeLocalBookmark,
} from './storage';
import { buildReviewedTest } from './format';
import type {
  BookmarkRecord,
  GeneratedTest,
  ReviewedTest,
  TestQuestion,
  TestSummary,
} from '../types';

export function isSignedIn(): boolean {
  return Boolean(getStoredToken());
}

export interface CompletionResult {
  test: ReviewedTest;
  synced: boolean;
  error?: string;
}

export async function completeTest(
  test: GeneratedTest,
  answers: Record<string, string | null>,
  durationSeconds: number,
  startedAt: string | null,
): Promise<CompletionResult> {
  const reviewed = buildReviewedTest(test, answers, durationSeconds, startedAt);

  if (isSignedIn()) {
    try {
      const { test: saved } = await api.saveHistory({
        config: reviewed.config,
        responses: reviewed.questions.map((question) => ({
          questionId: question.id,
          answer: question.userAnswer,
        })),
        durationSeconds: reviewed.durationSeconds,
        startedAt,
      });
      cacheTestResult(saved);
      return { test: saved, synced: true };
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'The result could not be synced with your account.';
      const local = saveLocalTest(reviewed);
      cacheTestResult(local);
      return { test: local, synced: false, error: message };
    }
  }

  const local = saveLocalTest(reviewed);
  cacheTestResult(local);
  return { test: local, synced: true };
}

export async function loadHistory(limit = 100): Promise<TestSummary[]> {
  if (isSignedIn()) {
    const { tests } = await api.listHistory(limit);
    return tests;
  }
  return getLocalSummaries();
}

export async function loadTestById(id: string): Promise<ReviewedTest | null> {
  const cached = getCachedTestResult(id);
  if (cached) return cached;

  const local = getLocalTest(id);
  if (local) return local;

  if (isSignedIn() && !id.startsWith('local-test-')) {
    try {
      const { test } = await api.getHistory(id);
      cacheTestResult(test);
      return test;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }
  return null;
}

export async function deleteTestRecord(id: string): Promise<void> {
  if (isSignedIn() && !id.startsWith('local-test-')) {
    await api.deleteHistory(id);
    return;
  }
  deleteLocalTest(id);
}

export async function loadBookmarks(): Promise<BookmarkRecord[]> {
  if (isSignedIn()) {
    const { bookmarks } = await api.listBookmarks();
    return bookmarks;
  }
  return getLocalBookmarks();
}

export async function toggleBookmark(
  question: TestQuestion,
  bookmarked: boolean,
): Promise<boolean> {
  if (isSignedIn()) {
    if (bookmarked) {
      await api.deleteBookmark(question.id);
      return false;
    }
    await api.addBookmark(question.id);
    return true;
  }

  if (bookmarked) {
    removeLocalBookmark(question.id);
    return false;
  }
  addLocalBookmark(question);
  return true;
}

export async function removeBookmark(questionId: string): Promise<void> {
  if (isSignedIn()) {
    await api.deleteBookmark(questionId);
    return;
  }
  removeLocalBookmark(questionId);
}

export async function saveMistakesToBookmarks(
  test: ReviewedTest,
): Promise<{ saved: number; total: number }> {
  const mistakes = test.questions.filter((question) => !question.isCorrect);
  if (!mistakes.length) return { saved: 0, total: 0 };

  if (isSignedIn()) {
    const results = await Promise.allSettled(
      mistakes.map((question) => api.addBookmark(question.id)),
    );
    return {
      saved: results.filter((result) => result.status === 'fulfilled').length,
      total: mistakes.length,
    };
  }

  for (const question of mistakes) addLocalBookmark(question);
  return { saved: mistakes.length, total: mistakes.length };
}

export interface ImportResult {
  tests: number;
  bookmarks: number;
  failed: number;
}

/**
 * Pushes guest history and bookmarks into the signed-in account. Local data is
 * only cleared when every record is accepted by the API.
 */
export async function importGuestData(): Promise<ImportResult> {
  const tests = getLocalHistory();
  const bookmarks = getLocalBookmarks();
  if (!tests.length && !bookmarks.length) {
    return { tests: 0, bookmarks: 0, failed: 0 };
  }

  let failed = 0;
  let importedTests = 0;
  let importedBookmarks = 0;

  for (const test of tests) {
    try {
      await api.saveHistory({
        config: test.config,
        responses: test.questions.map((question) => ({
          questionId: question.id,
          answer: question.userAnswer,
        })),
        durationSeconds: test.durationSeconds,
        startedAt: test.startedAt,
      });
      importedTests++;
    } catch {
      failed++;
    }
  }

  for (const bookmark of bookmarks) {
    try {
      await api.addBookmark(bookmark.questionId);
      importedBookmarks++;
    } catch {
      failed++;
    }
  }

  if (!failed) {
    clearLocalHistory();
    clearLocalBookmarks();
  }

  return { tests: importedTests, bookmarks: importedBookmarks, failed };
}
