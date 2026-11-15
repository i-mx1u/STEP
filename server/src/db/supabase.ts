import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import type { Database, NewTestRecord } from './types.js';
import type {
  BookmarkRecord,
  BookmarkSnapshot,
  ReviewedTest,
  Section,
  TestConfig,
  TestSummary,
  UserRecord,
} from '../types.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: string;
}

interface TestRow {
  id: string;
  config: TestConfig;
  score: number;
  correct_count: number;
  total_count: number;
  answered_count: number;
  duration_seconds: number;
  started_at: string | null;
  completed_at: string;
  questions?: ReviewedTest['questions'];
}

interface BookmarkRow {
  id: string;
  question_id: string;
  model_id: number;
  section: string;
  snapshot: BookmarkSnapshot;
  created_at: string;
}

function toSummary(row: TestRow): TestSummary {
  return {
    id: row.id,
    score: row.score,
    correctCount: row.correct_count,
    totalCount: row.total_count,
    answeredCount: row.answered_count,
    durationSeconds: row.duration_seconds,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    config: row.config,
  };
}

function toBookmark(row: BookmarkRow): BookmarkRecord {
  return {
    id: row.id,
    questionId: row.question_id,
    modelId: row.model_id,
    section: row.section as Section,
    snapshot: row.snapshot,
    createdAt: row.created_at,
  };
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message || 'Unknown Supabase error'}`);
}

export class SupabaseDatabase implements Database {
  provider = 'supabase' as const;
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async init() {
    const { error } = await this.client.from('step_users').select('id').limit(1);
    if (error) {
      throw new Error(
        `Could not reach the Supabase schema (${error.message}). Run server/supabase/schema.sql in the Supabase SQL editor first.`,
      );
    }
  }

  async createUser(user: UserRecord) {
    const { data, error } = await this.client
      .from('step_users')
      .insert({
        id: user.id,
        email: user.email,
        password_hash: user.passwordHash,
        display_name: user.displayName,
        created_at: user.createdAt,
      })
      .select('*')
      .single<UserRow>();
    if (error) fail('Could not create user', error);
    return this.mapUser(data as UserRow);
  }

  async findUserByEmail(email: string) {
    const { data, error } = await this.client
      .from('step_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle<UserRow>();
    if (error) fail('Could not look up user', error);
    return data ? this.mapUser(data) : null;
  }

  async findUserById(id: string) {
    const { data, error } = await this.client
      .from('step_users')
      .select('*')
      .eq('id', id)
      .maybeSingle<UserRow>();
    if (error) fail('Could not look up user', error);
    return data ? this.mapUser(data) : null;
  }

  private mapUser(row: UserRow): UserRecord {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      displayName: row.display_name,
      createdAt: row.created_at,
    };
  }

  async saveTest(userId: string, test: NewTestRecord): Promise<ReviewedTest> {
    const id = crypto.randomUUID();
    const { data, error } = await this.client
      .from('step_test_history')
      .insert({
        id,
        user_id: userId,
        config: test.config,
        score: test.score,
        correct_count: test.correctCount,
        total_count: test.totalCount,
        answered_count: test.answeredCount,
        duration_seconds: test.durationSeconds,
        started_at: test.startedAt,
        completed_at: test.completedAt,
        questions: test.questions,
      })
      .select('*')
      .single<TestRow>();
    if (error) fail('Could not save test', error);
    return { ...toSummary(data as TestRow), questions: test.questions };
  }

  async listTests(userId: string, limit = 100): Promise<TestSummary[]> {
    const { data, error } = await this.client
      .from('step_test_history')
      .select(
        'id, config, score, correct_count, total_count, answered_count, duration_seconds, started_at, completed_at',
      )
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(limit);
    if (error) fail('Could not load test history', error);
    return ((data || []) as TestRow[]).map(toSummary);
  }

  async getTest(userId: string, id: string): Promise<ReviewedTest | null> {
    const { data, error } = await this.client
      .from('step_test_history')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle<TestRow>();
    if (error) fail('Could not load test', error);
    if (!data) return null;
    return { ...toSummary(data), questions: data.questions || [] };
  }

  async deleteTest(userId: string, id: string) {
    const { data, error } = await this.client
      .from('step_test_history')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id');
    if (error) fail('Could not delete test', error);
    return Boolean(data?.length);
  }

  async listBookmarks(userId: string): Promise<BookmarkRecord[]> {
    const { data, error } = await this.client
      .from('step_bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) fail('Could not load bookmarks', error);
    return ((data || []) as BookmarkRow[]).map(toBookmark);
  }

  async addBookmark(
    userId: string,
    questionId: string,
    modelId: number,
    section: Section,
    snapshot: BookmarkSnapshot,
  ): Promise<BookmarkRecord> {
    const { data: existing, error: existingError } = await this.client
      .from('step_bookmarks')
      .select('*')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .maybeSingle<BookmarkRow>();
    if (existingError) fail('Could not check bookmark', existingError);
    if (existing) return toBookmark(existing);

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const { data, error } = await this.client
      .from('step_bookmarks')
      .insert({
        id,
        user_id: userId,
        question_id: questionId,
        model_id: modelId,
        section,
        snapshot,
        created_at: createdAt,
      })
      .select('*')
      .single<BookmarkRow>();
    if (error) fail('Could not save bookmark', error);
    return toBookmark(data as BookmarkRow);
  }

  async deleteBookmark(userId: string, questionId: string) {
    const { data, error } = await this.client
      .from('step_bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .select('id');
    if (error) fail('Could not delete bookmark', error);
    return Boolean(data?.length);
  }
}
