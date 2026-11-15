import { Router } from 'express';
import { z } from 'zod';
import { generateTest, getBankMeta, getCatalog } from '../bank.js';
import type { Section } from '../types.js';

export const contentRouter = Router();

const generateSchema = z.object({
  modelIds: z.array(z.number().int().min(5).max(51)).max(47).optional(),
  sections: z.array(z.enum(['reading', 'grammar'])).min(1).optional(),
  readingCount: z.number().int().min(0).max(200).optional(),
  grammarCount: z.number().int().min(0).max(200).optional(),
  secondsPerQuestion: z.number().int().min(10).max(600).optional(),
  questionIds: z.array(z.string().min(3).max(40)).max(200).optional(),
});

contentRouter.get('/catalog', (_req, res) => {
  res.json({
    catalog: getCatalog(),
    meta: getBankMeta(),
  });
});

contentRouter.post('/tests/generate', (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid test setup.' });
    return;
  }

  const body = parsed.data;
  const secondsPerQuestion = body.secondsPerQuestion ?? 60;

  if (body.questionIds?.length) {
    const test = generateTest({
      modelIds: [],
      sections: ['reading', 'grammar'],
      readingCount: 0,
      grammarCount: 0,
      secondsPerQuestion,
      questionIds: body.questionIds,
    });
    res.json({ test });
    return;
  }

  const modelIds = [...new Set(body.modelIds || [])];
  const sections = [...new Set(body.sections || ['reading', 'grammar'])] as Section[];

  if (!modelIds.length) {
    res.status(400).json({ error: 'Select at least one model.' });
    return;
  }

  const readingCount = sections.includes('reading') ? (body.readingCount ?? 20) : 0;
  const grammarCount = sections.includes('grammar') ? (body.grammarCount ?? 20) : 0;

  if (readingCount + grammarCount === 0) {
    res.status(400).json({ error: 'Choose at least one question.' });
    return;
  }
  if (readingCount + grammarCount > 200) {
    res.status(400).json({ error: 'A single test can contain at most 200 questions.' });
    return;
  }

  const test = generateTest({
    modelIds,
    sections,
    readingCount,
    grammarCount,
    secondsPerQuestion,
  });

  if (!test.questions.length) {
    res.status(422).json({
      error:
        'No playable questions were found for this selection. Try another model or section.',
      warnings: test.warnings,
    });
    return;
  }

  res.json({ test });
});
