export type Section = 'reading' | 'grammar';

export interface Option {
  label: string;
  text: string;
}

export interface CatalogModel {
  id: number;
  title: string;
  reading: { total: number; playable: number; passages: number };
  grammar: { total: number; playable: number };
}

export interface BankTotals {
  models: number;
  passages: number;
  questions: number;
  playable: number;
  reading: number;
  grammar: number;
  answerMissing: number;
}

export interface BankMeta {
  generatedAt: string;
  sourceDir: string;
  recoveredAnswers: number;
  totals: BankTotals;
}

export interface Catalog {
  totals: BankTotals;
  models: CatalogModel[];
}

export interface CatalogResponse {
  catalog: Catalog;
  meta: BankMeta;
}

export interface PassageSnapshot {
  id: string;
  label: string;
  title: string;
  text: string;
}

export interface TestQuestion {
  id: string;
  section: Section;
  modelId: number;
  modelTitle: string;
  number: number;
  sourceNumber: number;
  text: string;
  options: Option[];
  correctAnswer: string;
  passage: PassageSnapshot | null;
}

export interface TestConfig {
  modelIds: number[];
  sections: Section[];
  secondsPerQuestion: number;
  requestedReadingCount: number;
  requestedGrammarCount: number;
  readingCount: number;
  grammarCount: number;
  label: string;
  readingCorrect?: number;
  readingTotal?: number;
  grammarCorrect?: number;
  grammarTotal?: number;
}

export interface GeneratedTest {
  id: string;
  generatedAt: string;
  totalSeconds: number;
  config: TestConfig;
  questions: TestQuestion[];
  warnings: string[];
  meta: {
    availableReading: number;
    availableGrammar: number;
  };
}

export interface GenerateTestInput {
  modelIds?: number[];
  sections?: Section[];
  readingCount?: number;
  grammarCount?: number;
  secondsPerQuestion?: number;
  questionIds?: string[];
}

export interface ReviewedQuestion extends TestQuestion {
  userAnswer: string | null;
  isCorrect: boolean;
}

export interface TestSummary {
  id: string;
  score: number;
  correctCount: number;
  totalCount: number;
  answeredCount: number;
  durationSeconds: number;
  completedAt: string;
  startedAt: string | null;
  config: TestConfig;
}

export interface ReviewedTest extends TestSummary {
  questions: ReviewedQuestion[];
}

export interface BookmarkSnapshot {
  questionId: string;
  number: number;
  section: Section;
  modelId: number;
  modelTitle: string;
  text: string;
  options: Option[];
  correctAnswer: string;
  passage: PassageSnapshot | null;
}

export interface BookmarkRecord {
  id: string;
  questionId: string;
  modelId: number;
  section: Section;
  snapshot: BookmarkSnapshot;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface DashboardStats {
  completedTests: number;
  averageScore: number;
  bestScore: number;
  totalQuestions: number;
  totalCorrect: number;
  readingAverage: number | null;
  grammarAverage: number | null;
  streakDays: number;
  recent: TestSummary[];
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface ActiveTestSession {
  test: GeneratedTest;
  answers: Record<string, string | null>;
  revealed: string[];
  bookmarked: string[];
  currentIndex: number;
  deadline: number | null;
  startedAt: string;
  untimed: boolean;
}
