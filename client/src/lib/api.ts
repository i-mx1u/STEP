import type {
  AuthResponse,
  BookmarkRecord,
  CatalogResponse,
  DashboardStats,
  GenerateTestInput,
  GeneratedTest,
  PublicUser,
  ReviewedTest,
  Section,
  TestConfig,
  TestSummary,
} from '../types';
import { getStoredToken } from './storage';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  warnings?: string[];

  constructor(message: string, status: number, warnings?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.warnings = warnings;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    throw new ApiError(
      'Could not reach the STEPWISE API. Check your connection and try again.',
      0,
    );
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    const message =
      (data && typeof data.error === 'string' && data.error) ||
      `Request failed with status ${response.status}.`;
    const warnings =
      data && Array.isArray(data.warnings) ? (data.warnings as string[]) : undefined;
    throw new ApiError(message, response.status, warnings);
  }

  return data as T;
}

export interface SaveHistoryInput {
  config: TestConfig;
  responses: { questionId: string; answer: string | null }[];
  durationSeconds: number;
  startedAt: string | null;
}

export const api = {
  health: () =>
    request<{ ok: boolean; time: string }>('/api/health', { auth: false }),

  catalog: (signal?: AbortSignal) =>
    request<CatalogResponse>('/api/catalog', { auth: false, signal }),

  generateTest: (input: GenerateTestInput) =>
    request<{ test: GeneratedTest }>('/api/tests/generate', {
      method: 'POST',
      body: input,
      auth: false,
    }),

  register: (input: { name: string; email: string; password: string }) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: input,
      auth: false,
    }),

  login: (input: { email: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: input,
      auth: false,
    }),

  me: (signal?: AbortSignal) =>
    request<{ user: PublicUser }>('/api/auth/me', { signal }),

  saveHistory: (input: SaveHistoryInput) =>
    request<{ test: ReviewedTest }>('/api/history', { method: 'POST', body: input }),

  listHistory: (limit = 100, signal?: AbortSignal) =>
    request<{ tests: TestSummary[] }>(`/api/history?limit=${limit}`, { signal }),

  getHistory: (id: string, signal?: AbortSignal) =>
    request<{ test: ReviewedTest }>(`/api/history/${encodeURIComponent(id)}`, {
      signal,
    }),

  deleteHistory: (id: string) =>
    request<void>(`/api/history/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getStats: (signal?: AbortSignal) =>
    request<{ stats: DashboardStats }>('/api/stats', { signal }),

  listBookmarks: (signal?: AbortSignal) =>
    request<{ bookmarks: BookmarkRecord[] }>('/api/bookmarks', { signal }),

  addBookmark: (questionId: string) =>
    request<{ bookmark: BookmarkRecord }>('/api/bookmarks', {
      method: 'POST',
      body: { questionId },
    }),

  deleteBookmark: (questionId: string) =>
    request<void>(`/api/bookmarks/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    }),
};

export function isSection(value: unknown): value is Section {
  return value === 'reading' || value === 'grammar';
}
