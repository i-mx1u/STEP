import { Router } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/index.js';
import { reviewTestResponses } from '../bank.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import type { DashboardStats, TestConfig } from '../types.js';

export const historyRouter = Router();
export const statsRouter = Router();

const configSchema = z.object({
  modelIds: z.array(z.number().int()).max(47).default([]),
  sections: z.array(z.enum(['reading', 'grammar'])).max(2).default([]),
  secondsPerQuestion: z.number().int().min(10).max(600).default(60),
  requestedReadingCount: z.number().int().min(0).max(200).default(0),
  requestedGrammarCount: z.number().int().min(0).max(200).default(0),
  readingCorrect: z.number().int().min(0).optional(),
  readingTotal: z.number().int().min(0).optional(),
  grammarCorrect: z.number().int().min(0).optional(),
  grammarTotal: z.number().int().min(0).optional(),
  label: z.string().trim().max(140).default('Practice test'),
});

const saveSchema = z.object({
  config: configSchema,
  responses: z
    .array(
      z.object({
        questionId: z.string().min(3).max(40),
        answer: z.enum(['A', 'B', 'C', 'D']).nullable().optional(),
      }),
    )
    .min(1)
    .max(200),
  durationSeconds: z.number().int().min(0).max(86_400).default(0),
  startedAt: z.string().max(50).nullable().optional(),
});

historyRouter.use(requireAuth);

historyRouter.get('/', async (req: AuthedRequest, res) => {
  const limitRaw = Number(req.query.limit || 100);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 250) : 100;
  const db = await getDatabase();
  const tests = await db.listTests(req.userId as string, limit);
  res.json({ tests });
});

historyRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid test data.' });
    return;
  }

  const { config: inputConfig, responses, durationSeconds, startedAt } = parsed.data;
  const baseConfig = {
    modelIds: inputConfig.modelIds,
    sections: inputConfig.sections,
    secondsPerQuestion: inputConfig.secondsPerQuestion,
    requestedReadingCount: inputConfig.requestedReadingCount,
    requestedGrammarCount: inputConfig.requestedGrammarCount,
    label: inputConfig.label,
  };

  const review = reviewTestResponses(baseConfig, responses);
  if (!review.totalCount) {
    res.status(400).json({ error: 'No valid questions were submitted.' });
    return;
  }

  const db = await getDatabase();
  const saved = await db.saveTest(req.userId as string, {
    config: review.config,
    score: review.score,
    correctCount: review.correctCount,
    totalCount: review.totalCount,
    answeredCount: review.answeredCount,
    durationSeconds,
    completedAt: new Date().toISOString(),
    startedAt: startedAt || null,
    questions: review.questions,
  });

  res.status(201).json({ test: saved });
});

historyRouter.get('/:id', async (req: AuthedRequest, res) => {
  const db = await getDatabase();
  const test = await db.getTest(req.userId as string, String(req.params.id));
  if (!test) {
    res.status(404).json({ error: 'Test not found.' });
    return;
  }
  res.json({ test });
});

historyRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const db = await getDatabase();
  const deleted = await db.deleteTest(req.userId as string, String(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'Test not found.' });
    return;
  }
  res.status(204).end();
});

statsRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const db = await getDatabase();
  const tests = await db.listTests(req.userId as string, 500);

  const completedTests = tests.length;
  const averageScore = completedTests
    ? Math.round(tests.reduce((sum, test) => sum + test.score, 0) / completedTests)
    : 0;
  const bestScore = completedTests ? Math.max(...tests.map((test) => test.score)) : 0;
  const totalQuestions = tests.reduce((sum, test) => sum + test.totalCount, 0);
  const totalCorrect = tests.reduce((sum, test) => sum + test.correctCount, 0);

  const readingTests = tests.filter((test) => (test.config.readingTotal || 0) > 0);
  const grammarTests = tests.filter((test) => (test.config.grammarTotal || 0) > 0);
  const average = (values: number[]) =>
    values.length ? Math.round(values.reduce((sum, n) => sum + n, 0) / values.length) : null;

  const readingAverage = average(
    readingTests.map(
      (test) =>
        ((test.config.readingCorrect || 0) / (test.config.readingTotal || 1)) * 100,
    ),
  );
  const grammarAverage = average(
    grammarTests.map(
      (test) =>
        ((test.config.grammarCorrect || 0) / (test.config.grammarTotal || 1)) * 100,
    ),
  );

  const days = new Set(tests.map((test) => test.completedAt.slice(0, 10)));
  const cursor = new Date();
  const todayKey = cursor.toISOString().slice(0, 10);
  if (!days.has(todayKey)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streakDays = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streakDays++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const stats: DashboardStats = {
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

  res.json({ stats });
});
