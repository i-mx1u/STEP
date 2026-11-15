import fs from 'node:fs';
import crypto from 'node:crypto';
import type {
  Bank,
  BankModel,
  BankPassage,
  BankQuestion,
  BookmarkSnapshot,
  GeneratedTest,
  ReviewedQuestion,
  Section,
  TestConfig,
  TestQuestion,
} from './types.js';
import { config } from './config.js';

const bank = JSON.parse(fs.readFileSync(config.bankFile, 'utf8')) as Bank;

interface QuestionEntry {
  question: BankQuestion;
  model: BankModel;
  passage: BankPassage | null;
  section: Section;
  passageOrder: number;
}

const questionIndex = new Map<string, QuestionEntry>();
const passageIndex = new Map<string, { passage: BankPassage; model: BankModel }>();

for (const model of bank.models) {
  model.reading.forEach((passage, passageOrder) => {
    passageIndex.set(passage.id, { passage, model });
    for (const question of passage.questions) {
      questionIndex.set(question.id, {
        question,
        model,
        passage,
        section: 'reading',
        passageOrder,
      });
    }
  });
  for (const question of model.grammar) {
    questionIndex.set(question.id, {
      question,
      model,
      passage: null,
      section: 'grammar',
      passageOrder: 0,
    });
  }
}

const seenIds = new Set<string>();
for (const id of questionIndex.keys()) {
  if (seenIds.has(id)) throw new Error(`Duplicate question id in bank: ${id}`);
  seenIds.add(id);
}

if (questionIndex.size === 0) throw new Error('The question bank is empty.');

export function isPlayable(question: BankQuestion): boolean {
  return Boolean(
    question.correctAnswer &&
      question.options.length === 4 &&
      question.options.every((option) => option.text.trim()) &&
      question.text.trim() &&
      question.options.some((option) => option.label === question.correctAnswer),
  );
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function questionKey(question: BankQuestion): string {
  return `${normalize(question.text)}|${question.options
    .map((option) => normalize(option.text))
    .join('|')}`;
}

function passageKey(passage: BankPassage): string {
  const normalized = normalize(passage.text);
  if (normalized.length > 80) return `text:${normalized}`;
  return `empty:${passage.id}`;
}

function toTestQuestion(entry: QuestionEntry): TestQuestion {
  return {
    id: entry.question.id,
    section: entry.section,
    modelId: entry.model.id,
    modelTitle: entry.model.title,
    number: entry.question.number,
    sourceNumber: entry.question.sourceNumber,
    text: entry.question.text,
    options: entry.question.options,
    correctAnswer: entry.question.correctAnswer as string,
    passage: entry.passage
      ? {
          id: entry.passage.id,
          label: entry.passage.label,
          title: entry.passage.title || entry.passage.label,
          text: entry.passage.text,
        }
      : null,
  };
}

export interface GenerateOptions {
  modelIds: number[];
  sections: Section[];
  readingCount: number;
  grammarCount: number;
  secondsPerQuestion: number;
  questionIds?: string[];
}

function configLabel(modelIds: number[], sections: Section[]): string {
  const modelLabel =
    modelIds.length === 1 ? `Model ${modelIds[0]}` : `${modelIds.length} models`;
  const sectionLabel =
    sections.length === 2
      ? 'Reading + Grammar'
      : sections[0] === 'reading'
        ? 'Reading only'
        : 'Grammar only';
  return `${modelLabel} · ${sectionLabel}`;
}

export function generateTest(options: GenerateOptions): GeneratedTest {
  const warnings: string[] = [];
  const generatedAt = new Date().toISOString();

  if (options.questionIds?.length) {
    const entries: QuestionEntry[] = [];
    const seen = new Set<string>();
    const missing: string[] = [];

    for (const id of options.questionIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const entry = questionIndex.get(id);
      if (!entry || !isPlayable(entry.question)) {
        missing.push(id);
        continue;
      }
      entries.push(entry);
    }

    // Keep reading questions grouped by passage, then grammar.
    entries.sort((a, b) => {
      if (a.section !== b.section) return a.section === 'reading' ? -1 : 1;
      if (a.model.id !== b.model.id) return a.model.id - b.model.id;
      if (a.passageOrder !== b.passageOrder) return a.passageOrder - b.passageOrder;
      return a.question.number - b.question.number;
    });

    const questions = entries.slice(0, 200).map(toTestQuestion);
    if (missing.length) {
      warnings.push(
        `${missing.length} bookmarked question${missing.length === 1 ? ' was' : 's were'} not found in the bank and skipped.`,
      );
    }
    if (!questions.length) warnings.push('No playable bookmarked questions were found.');

    const modelIds = [...new Set(questions.map((question) => question.modelId))].sort(
      (a, b) => a - b,
    );
    const sections = (['reading', 'grammar'] as Section[]).filter((section) =>
      questions.some((question) => question.section === section),
    );
    const totalSeconds = questions.length * options.secondsPerQuestion;

    return {
      id: crypto.randomUUID(),
      generatedAt,
      totalSeconds,
      config: {
        modelIds,
        sections,
        secondsPerQuestion: options.secondsPerQuestion,
        requestedReadingCount: questions.filter((q) => q.section === 'reading').length,
        requestedGrammarCount: questions.filter((q) => q.section === 'grammar').length,
        readingCount: questions.filter((q) => q.section === 'reading').length,
        grammarCount: questions.filter((q) => q.section === 'grammar').length,
        label: 'Bookmarked questions',
      },
      questions,
      warnings,
      meta: {
        availableReading: questions.filter((q) => q.section === 'reading').length,
        availableGrammar: questions.filter((q) => q.section === 'grammar').length,
      },
    };
  }

  const selectedModels = bank.models.filter((model) => options.modelIds.includes(model.id));
  const wantsReading = options.sections.includes('reading');
  const wantsGrammar = options.sections.includes('grammar');

  const availableReading = selectedModels.reduce(
    (total, model) =>
      total +
      model.reading.reduce(
        (sum, passage) => sum + passage.questions.filter(isPlayable).length,
        0,
      ),
    0,
  );
  const availableGrammar = selectedModels.reduce(
    (total, model) => total + model.grammar.filter(isPlayable).length,
    0,
  );

  const readingQuestions: TestQuestion[] = [];
  if (wantsReading) {
    const target = options.readingCount;
    const candidates = [];
    for (const model of selectedModels) {
      for (const passage of model.reading) {
        const playable = passage.questions.filter(isPlayable);
        if (!playable.length) continue;
        candidates.push({ model, passage, playable });
      }
    }

    const usedPassages = new Set<string>();
    const usedQuestions = new Set<string>();
    let count = 0;

    for (const candidate of shuffle(candidates)) {
      if (count >= target) break;
      const pKey = passageKey(candidate.passage);
      if (usedPassages.has(pKey)) continue;

      const fresh = candidate.playable.filter(
        (question) => !usedQuestions.has(questionKey(question)),
      );
      if (!fresh.length) continue;

      const remaining = target - count;
      const selected = fresh.slice(0, remaining);
      if (!selected.length) continue;

      usedPassages.add(pKey);
      for (const question of selected) {
        usedQuestions.add(questionKey(question));
        readingQuestions.push(
          toTestQuestion({
            question,
            model: candidate.model,
            passage: candidate.passage,
            section: 'reading',
            passageOrder: 0,
          }),
        );
      }
      count += selected.length;
    }
  }

  const grammarQuestions: TestQuestion[] = [];
  if (wantsGrammar) {
    const usedQuestions = new Set<string>();
    const pool: QuestionEntry[] = [];
    for (const model of selectedModels) {
      for (const question of model.grammar) {
        if (!isPlayable(question)) continue;
        const key = questionKey(question);
        if (usedQuestions.has(key)) continue;
        usedQuestions.add(key);
        pool.push({ question, model, passage: null, section: 'grammar', passageOrder: 0 });
      }
    }
    grammarQuestions.push(
      ...shuffle(pool)
        .slice(0, options.grammarCount)
        .map(toTestQuestion),
    );
  }

  if (wantsReading && readingQuestions.length < options.readingCount) {
    warnings.push(
      `Only ${readingQuestions.length} reading questions were available from the selected models.`,
    );
  }
  if (wantsGrammar && grammarQuestions.length < options.grammarCount) {
    warnings.push(
      `Only ${grammarQuestions.length} grammar questions were available from the selected models.`,
    );
  }
  if (wantsReading && availableReading === 0) {
    warnings.push('The selected models do not contain any playable reading questions.');
  }
  if (wantsGrammar && availableGrammar === 0) {
    warnings.push('The selected models do not contain any playable grammar questions.');
  }

  const questions = [...readingQuestions, ...grammarQuestions];
  const sections = (['reading', 'grammar'] as Section[]).filter((section) =>
    questions.some((question) => question.section === section),
  );
  const modelIds = [...new Set(questions.map((question) => question.modelId))].sort(
    (a, b) => a - b,
  );

  return {
    id: crypto.randomUUID(),
    generatedAt,
    totalSeconds: questions.length * options.secondsPerQuestion,
    config: {
      modelIds,
      sections,
      secondsPerQuestion: options.secondsPerQuestion,
      requestedReadingCount: wantsReading ? options.readingCount : 0,
      requestedGrammarCount: wantsGrammar ? options.grammarCount : 0,
      readingCount: readingQuestions.length,
      grammarCount: grammarQuestions.length,
      label: configLabel(options.modelIds, options.sections),
    },
    questions,
    warnings,
    meta: { availableReading, availableGrammar },
  };
}

export interface ReviewResponse {
  questionId: string;
  answer?: string | null;
}

export interface ReviewResult {
  config: TestConfig;
  questions: ReviewedQuestion[];
  score: number;
  correctCount: number;
  totalCount: number;
  answeredCount: number;
}

export function reviewTestResponses(
  baseConfig: Omit<TestConfig, 'readingCount' | 'grammarCount'>,
  responses: ReviewResponse[],
  maxQuestions = 200,
): ReviewResult {
  const reviewed: ReviewedQuestion[] = [];
  const seen = new Set<string>();

  for (const response of responses.slice(0, maxQuestions)) {
    if (seen.has(response.questionId)) continue;
    seen.add(response.questionId);
    const entry = questionIndex.get(response.questionId);
    if (!entry || !isPlayable(entry.question)) continue;
    const answer =
      response.answer && /^[A-D]$/.test(response.answer) ? response.answer : null;
    const correctAnswer = entry.question.correctAnswer as string;
    reviewed.push({
      ...toTestQuestion(entry),
      userAnswer: answer,
      isCorrect: answer === correctAnswer,
    });
  }

  const correctCount = reviewed.filter((question) => question.isCorrect).length;
  const answeredCount = reviewed.filter((question) => question.userAnswer).length;
  const totalCount = reviewed.length;
  const readingQuestions = reviewed.filter((question) => question.section === 'reading');
  const grammarQuestions = reviewed.filter((question) => question.section === 'grammar');

  return {
    config: {
      ...baseConfig,
      modelIds: [...new Set(reviewed.map((question) => question.modelId))].sort(
        (a, b) => a - b,
      ),
      sections: (['reading', 'grammar'] as Section[]).filter((section) =>
        reviewed.some((question) => question.section === section),
      ),
      readingCount: readingQuestions.length,
      grammarCount: grammarQuestions.length,
      readingCorrect: readingQuestions.filter((question) => question.isCorrect).length,
      readingTotal: readingQuestions.length,
      grammarCorrect: grammarQuestions.filter((question) => question.isCorrect).length,
      grammarTotal: grammarQuestions.length,
    },
    questions: reviewed,
    score: totalCount ? Math.round((correctCount / totalCount) * 100) : 0,
    correctCount,
    totalCount,
    answeredCount,
  };
}

export function getBookmarkSnapshot(questionId: string): BookmarkSnapshot | null {
  const entry = questionIndex.get(questionId);
  if (!entry || !isPlayable(entry.question)) return null;
  const testQuestion = toTestQuestion(entry);
  return {
    questionId: testQuestion.id,
    number: testQuestion.number,
    section: testQuestion.section,
    modelId: testQuestion.modelId,
    modelTitle: testQuestion.modelTitle,
    text: testQuestion.text,
    options: testQuestion.options,
    correctAnswer: testQuestion.correctAnswer,
    passage: testQuestion.passage,
  };
}

export function getBank() {
  return bank;
}

export function getBankMeta() {
  return bank.meta;
}

export function getCatalog() {
  return bank.catalog;
}

export { questionIndex, passageIndex };
