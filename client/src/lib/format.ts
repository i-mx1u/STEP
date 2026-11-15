import type {
  DashboardStats,
  GeneratedTest,
  ReviewedQuestion,
  ReviewedTest,
  Section,
  TestConfig,
  TestQuestion,
  TestSummary,
} from '../types';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`;
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes < 60) {
    return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours}h ${restMinutes}m` : `${hours}h`;
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function formatDate(iso: string, withTime = true): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(date);
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}

export function timeAgo(iso: string): string {
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return 'Unknown';
  const diff = Date.now() - date;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(iso);
}

export function sectionLabel(section: Section): string {
  return section === 'reading' ? 'Reading' : 'Grammar';
}

export function sectionsLabel(sections: Section[]): string {
  if (sections.length === 2) return 'Reading + Grammar';
  if (sections[0] === 'reading') return 'Reading only';
  return 'Grammar only';
}

export function scoreTone(score: number): {
  text: string;
  bg: string;
  ring: string;
  label: string;
} {
  if (score >= 90)
    return {
      text: 'text-mint-700',
      bg: 'bg-mint-50',
      ring: '#1e7f5e',
      label: 'Outstanding',
    };
  if (score >= 80)
    return {
      text: 'text-mint-700',
      bg: 'bg-mint-50',
      ring: '#2b9f75',
      label: 'Strong work',
    };
  if (score >= 70)
    return {
      text: 'text-brand-700',
      bg: 'bg-brand-50',
      ring: '#2548e8',
      label: 'On track',
    };
  if (score >= 60)
    return {
      text: 'text-amber-600',
      bg: 'bg-amber-50',
      ring: '#d97706',
      label: 'Getting there',
    };
  return {
    text: 'text-rose-600',
    bg: 'bg-rose-50',
    ring: '#e11d48',
    label: 'Keep building',
  };
}

export function scoreMessage(score: number): string {
  if (score >= 90) return 'Superb accuracy. Your STEP readiness is looking excellent.';
  if (score >= 80) return 'A strong result. Review the few misses and keep the momentum.';
  if (score >= 70) return 'Solid foundation. Targeted review will lift your score quickly.';
  if (score >= 60) return 'You are close. Focus on your weaker section and retry.';
  return 'Every attempt builds skill. Review each explanation and try a shorter drill.';
}

export function buildReviewedTest(
  test: GeneratedTest,
  answers: Record<string, string | null>,
  durationSeconds: number,
  startedAt: string | null,
  id?: string,
): ReviewedTest {
  const questions: ReviewedQuestion[] = test.questions.map((question) => {
    const rawAnswer = answers[question.id];
    const userAnswer = rawAnswer && /^[A-D]$/.test(rawAnswer) ? rawAnswer : null;
    return {
      ...question,
      userAnswer,
      isCorrect: userAnswer === question.correctAnswer,
    };
  });

  const correctCount = questions.filter((question) => question.isCorrect).length;
  const answeredCount = questions.filter((question) => question.userAnswer).length;
  const reading = questions.filter((question) => question.section === 'reading');
  const grammar = questions.filter((question) => question.section === 'grammar');

  const config: TestConfig = {
    ...test.config,
    modelIds: [...new Set(questions.map((question) => question.modelId))].sort(
      (a, b) => a - b,
    ),
    sections: (['reading', 'grammar'] as Section[]).filter((section) =>
      questions.some((question) => question.section === section),
    ),
    readingCount: reading.length,
    grammarCount: grammar.length,
    readingCorrect: reading.filter((question) => question.isCorrect).length,
    readingTotal: reading.length,
    grammarCorrect: grammar.filter((question) => question.isCorrect).length,
    grammarTotal: grammar.length,
  };

  return {
    id: id || `local-test-${crypto.randomUUID()}`,
    config,
    score: questions.length ? Math.round((correctCount / questions.length) * 100) : 0,
    correctCount,
    totalCount: questions.length,
    answeredCount,
    durationSeconds: Math.max(0, Math.round(durationSeconds)),
    completedAt: new Date().toISOString(),
    startedAt,
    questions,
  };
}

export function computeStats(tests: TestSummary[]): DashboardStats {
  const completedTests = tests.length;
  const averageScore = completedTests
    ? Math.round(tests.reduce((sum, test) => sum + test.score, 0) / completedTests)
    : 0;
  const bestScore = completedTests ? Math.max(...tests.map((test) => test.score)) : 0;
  const totalQuestions = tests.reduce((sum, test) => sum + test.totalCount, 0);
  const totalCorrect = tests.reduce((sum, test) => sum + test.correctCount, 0);

  const average = (values: number[]) =>
    values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : null;

  const readingAverage = average(
    tests
      .filter((test) => (test.config.readingTotal || 0) > 0)
      .map(
        (test) =>
          ((test.config.readingCorrect || 0) / (test.config.readingTotal || 1)) * 100,
      ),
  );
  const grammarAverage = average(
    tests
      .filter((test) => (test.config.grammarTotal || 0) > 0)
      .map(
        (test) =>
          ((test.config.grammarCorrect || 0) / (test.config.grammarTotal || 1)) * 100,
      ),
  );

  const days = new Set(tests.map((test) => test.completedAt.slice(0, 10)));
  const cursor = new Date();
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streakDays = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streakDays++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return {
    completedTests,
    averageScore,
    bestScore,
    totalQuestions,
    totalCorrect,
    readingAverage,
    grammarAverage,
    streakDays,
    recent: tests.slice(0, 5),
  };
}

export interface ReadingGroup {
  key: string;
  id: string;
  label: string;
  title: string;
  section: Section;
  startIndex: number;
  questions: TestQuestion[];
}

export function groupQuestions(questions: TestQuestion[]): ReadingGroup[] {
  const groups: ReadingGroup[] = [];
  questions.forEach((question, index) => {
    if (question.section === 'grammar') {
      const last = groups[groups.length - 1];
      if (last?.key === 'grammar') {
        last.questions.push(question);
        return;
      }
      groups.push({
        key: 'grammar',
        id: 'grammar',
        label: 'Grammar',
        title: 'Grammar',
        section: 'grammar',
        startIndex: index,
        questions: [question],
      });
      return;
    }

    const key = question.passage?.id || `reading-${index}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.questions.push(question);
      return;
    }
    groups.push({
      key,
      id: question.passage?.id || key,
      label: question.passage?.label || 'Reading',
      title: question.passage?.title || question.passage?.label || 'Reading passage',
      section: 'reading',
      startIndex: index,
      questions: [question],
    });
  });
  return groups;
}

export function optionText(question: TestQuestion, label: string | null): string {
  if (!label) return '';
  return question.options.find((option) => option.label === label)?.text || '';
}

export interface FormattedPassage {
  paragraphs: string[];
  preserve: boolean;
}

/**
 * Source passages are hard-wrapped at roughly 80 characters. Joining the soft
 * line breaks into paragraphs makes reading much easier on narrow screens,
 * while listings, warning signs and other layout-sensitive passages keep their
 * original line breaks.
 */
export function formatPassage(text: string): FormattedPassage {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return { paragraphs: [], preserve: false };

  const lines = normalized.split('\n');
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  const words = nonEmpty.join(' ').split(/\s+/).filter(Boolean).length;
  const averageWords = nonEmpty.length ? words / nonEmpty.length : 0;
  const bulletCount = nonEmpty.filter((line) => /^[•●▪]/.test(line)).length;
  const tabbed = lines.some((line) => line.includes('\t'));

  if (normalized.length < 140 || averageWords < 4.5 || tabbed || bulletCount >= 3) {
    return { paragraphs: [normalized], preserve: true };
  }

  const paragraphs: string[] = [];
  let current = '';

  const flush = () => {
    if (current.trim()) paragraphs.push(current.trim());
    current = '';
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }

    const startsBlock =
      /^\(\d+\)/.test(trimmed) ||
      /^\(\s*[\u0600-\u06FF]/.test(trimmed) ||
      /^[A-Z][A-Za-z'’\- ]{1,28}:/.test(trimmed) ||
      /^[•●▪\-*]\s/.test(trimmed) ||
      /^[A-Z][.)]\s/.test(trimmed) ||
      /^\d+[.)]\s/.test(trimmed) ||
      /^[A-Z][A-Z\d\s.'’\-]{3,}$/.test(trimmed) ||
      /^(Required|For sale|Message to|Notice|Advertisement|Wanted)\b/i.test(trimmed);

    if (startsBlock) {
      flush();
      current = trimmed;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }
  }
  flush();

  return { paragraphs, preserve: false };
}

export function greeting(name?: string): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name.split(' ')[0]}` : part;
}

export interface PresetDefinition {
  id: string;
  name: string;
  arabic: string;
  description: string;
  minutes: string;
  sections: Section[];
  readingCount: number;
  grammarCount: number;
  secondsPerQuestion: number;
}

export function presetToParams(preset: PresetDefinition, modelIds: number[]): string {
  const params = new URLSearchParams();
  params.set('preset', preset.id);
  params.set('sections', preset.sections.join(','));
  params.set('reading', String(preset.readingCount));
  params.set('grammar', String(preset.grammarCount));
  params.set('seconds', String(preset.secondsPerQuestion));
  if (modelIds.length) params.set('models', modelIds.join(','));
  return params.toString();
}
