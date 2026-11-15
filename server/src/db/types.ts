import type {
  BookmarkRecord,
  BookmarkSnapshot,
  ReviewedTest,
  Section,
  TestConfig,
  TestSummary,
  UserRecord,
} from '../types.js';

export interface NewTestRecord {
  config: TestConfig;
  score: number;
  correctCount: number;
  totalCount: number;
  answeredCount: number;
  durationSeconds: number;
  completedAt: string;
  startedAt: string | null;
  questions: ReviewedTest['questions'];
}

export interface Database {
  provider: 'sqlite' | 'supabase';
  init(): Promise<void>;
  createUser(user: UserRecord): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  saveTest(userId: string, test: NewTestRecord): Promise<ReviewedTest>;
  listTests(userId: string, limit?: number): Promise<TestSummary[]>;
  getTest(userId: string, id: string): Promise<ReviewedTest | null>;
  deleteTest(userId: string, id: string): Promise<boolean>;
  listBookmarks(userId: string): Promise<BookmarkRecord[]>;
  addBookmark(
    userId: string,
    questionId: string,
    modelId: number,
    section: Section,
    snapshot: BookmarkSnapshot,
  ): Promise<BookmarkRecord>;
  deleteBookmark(userId: string, questionId: string): Promise<boolean>;
}
