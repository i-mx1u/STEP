import { DatabaseSync } from 'node:sqlite';
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

interface TestRow {
  id: string;
  user_id: string;
  config_json: string;
  score: number;
  correct_count: number;
  total_count: number;
  answered_count: number;
  duration_seconds: number;
  started_at: string | null;
  completed_at: string;
  questions_json: string;
}

interface BookmarkRow {
  id: string;
  question_id: string;
  model_id: number;
  section: string;
  snapshot_json: string;
  created_at: string;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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
    config: parseJson<TestConfig>(row.config_json, {} as TestConfig),
  };
}

function toReviewedTest(row: TestRow): ReviewedTest {
  return {
    ...toSummary(row),
    questions: parseJson<ReviewedTest['questions']>(row.questions_json, []),
  };
}

function toBookmark(row: BookmarkRow): BookmarkRecord {
  return {
    id: row.id,
    questionId: row.question_id,
    modelId: row.model_id,
    section: row.section as Section,
    snapshot: parseJson<BookmarkSnapshot>(row.snapshot_json, {} as BookmarkSnapshot),
    createdAt: row.created_at,
  };
}

export class SQLiteDatabase implements Database {
  provider = 'sqlite' as const;
  private db: DatabaseSync;

  constructor(file: string) {
    this.db = new DatabaseSync(file);
  }

  async init() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS step_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS step_test_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES step_users(id) ON DELETE CASCADE,
        config_json TEXT NOT NULL,
        score INTEGER NOT NULL,
        correct_count INTEGER NOT NULL,
        total_count INTEGER NOT NULL,
        answered_count INTEGER NOT NULL,
        duration_seconds INTEGER NOT NULL,
        started_at TEXT,
        completed_at TEXT NOT NULL,
        questions_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_step_tests_user_completed
        ON step_test_history(user_id, completed_at DESC);
      CREATE TABLE IF NOT EXISTS step_bookmarks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES step_users(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL,
        model_id INTEGER NOT NULL,
        section TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, question_id)
      );
      CREATE INDEX IF NOT EXISTS idx_step_bookmarks_user_created
        ON step_bookmarks(user_id, created_at DESC);
    `);
  }

  async createUser(user: UserRecord) {
    this.db
      .prepare(
        `INSERT INTO step_users (id, email, password_hash, display_name, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(user.id, user.email, user.passwordHash, user.displayName, user.createdAt);
    return user;
  }

  async findUserByEmail(email: string) {
    const row = this.db
      .prepare('SELECT * FROM step_users WHERE email = ?')
      .get(email.toLowerCase()) as Record<string, unknown> | undefined;
    return row ? this.mapUser(row) : null;
  }

  async findUserById(id: string) {
    const row = this.db
      .prepare('SELECT * FROM step_users WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.mapUser(row) : null;
  }

  private mapUser(row: Record<string, unknown>): UserRecord {
    return {
      id: String(row.id),
      email: String(row.email),
      passwordHash: String(row.password_hash),
      displayName: String(row.display_name),
      createdAt: String(row.created_at),
    };
  }

  async saveTest(userId: string, test: NewTestRecord): Promise<ReviewedTest> {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO step_test_history
          (id, user_id, config_json, score, correct_count, total_count, answered_count,
           duration_seconds, started_at, completed_at, questions_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        userId,
        JSON.stringify(test.config),
        test.score,
        test.correctCount,
        test.totalCount,
        test.answeredCount,
        test.durationSeconds,
        test.startedAt,
        test.completedAt,
        JSON.stringify(test.questions),
      );

    return {
      id,
      ...test,
    };
  }

  async listTests(userId: string, limit = 100): Promise<TestSummary[]> {
    const rows = this.db
      .prepare(
        `SELECT id, user_id, config_json, score, correct_count, total_count,
                answered_count, duration_seconds, started_at, completed_at, questions_json
         FROM step_test_history
         WHERE user_id = ?
         ORDER BY completed_at DESC
         LIMIT ?`,
      )
      .all(userId, limit) as unknown as TestRow[];
    return rows.map(toSummary);
  }

  async getTest(userId: string, id: string): Promise<ReviewedTest | null> {
    const row = this.db
      .prepare('SELECT * FROM step_test_history WHERE id = ? AND user_id = ?')
      .get(id, userId) as unknown as TestRow | undefined;
    return row ? toReviewedTest(row) : null;
  }

  async deleteTest(userId: string, id: string) {
    const result = this.db
      .prepare('DELETE FROM step_test_history WHERE id = ? AND user_id = ?')
      .run(id, userId);
    return Number(result.changes) > 0;
  }

  async listBookmarks(userId: string): Promise<BookmarkRecord[]> {
    const rows = this.db
      .prepare('SELECT * FROM step_bookmarks WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as unknown as BookmarkRow[];
    return rows.map(toBookmark);
  }

  async addBookmark(
    userId: string,
    questionId: string,
    modelId: number,
    section: Section,
    snapshot: BookmarkSnapshot,
  ): Promise<BookmarkRecord> {
    const existing = this.db
      .prepare('SELECT * FROM step_bookmarks WHERE user_id = ? AND question_id = ?')
      .get(userId, questionId) as unknown as BookmarkRow | undefined;
    if (existing) return toBookmark(existing);

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO step_bookmarks
          (id, user_id, question_id, model_id, section, snapshot_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, userId, questionId, modelId, section, JSON.stringify(snapshot), createdAt);

    return {
      id,
      questionId,
      modelId,
      section,
      snapshot,
      createdAt,
    };
  }

  async deleteBookmark(userId: string, questionId: string) {
    const result = this.db
      .prepare('DELETE FROM step_bookmarks WHERE user_id = ? AND question_id = ?')
      .run(userId, questionId);
    return Number(result.changes) > 0;
  }
}
