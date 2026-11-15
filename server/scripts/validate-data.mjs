#!/usr/bin/env node
/**
 * STEP question-bank validator
 * ----------------------------
 * Fails the build when the generated bank contains structural or content
 * problems that would leak into the practice experience: broken option text,
 * duplicate ids, invalid answer keys, inconsistent totals, and so on.
 *
 * Usage:
 *   node server/scripts/validate-data.mjs
 *   STEP_BANK_FILE=/path/to/bank.json node server/scripts/validate-data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const BANK_FILE = path.resolve(
  process.env.STEP_BANK_FILE || path.join(ROOT, 'server', 'data', 'step-bank.json'),
);

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

function isPlayable(question) {
  return Boolean(
    question.correctAnswer &&
      question.options.length === 4 &&
      question.options.every((option) => option.text.trim()) &&
      question.text.trim() &&
      question.options.some((option) => option.label === question.correctAnswer),
  );
}

function checkQuestion(question, model, passage) {
  const where = `${question.id || '<missing id>'} (model ${model.id}${passage ? `, ${passage.id}` : ''})`;

  if (!/^m\d+-(r|g)\d+$/.test(question.id || '')) {
    fail(`${where}: invalid id format`);
  }
  if (!question.text || !question.text.trim()) {
    fail(`${where}: empty question text`);
  }
  if (question.text.length > 4000) {
    fail(`${where}: question text is ${question.text.length} characters (possible swallowed passage)`);
  }
  if (!Array.isArray(question.options) || question.options.length < 2) {
    fail(`${where}: expected at least two options`);
    return;
  }
  if (question.options.length > 6) {
    fail(`${where}: unexpected option count ${question.options.length}`);
  }

  const labels = new Set();
  for (const option of question.options) {
    if (!/^[A-F]$/.test(option.label || '')) {
      fail(`${where}: invalid option label ${JSON.stringify(option.label)}`);
    }
    if (labels.has(option.label)) {
      fail(`${where}: duplicate option label ${option.label}`);
    }
    labels.add(option.label);

    if (!option.text || !option.text.trim()) {
      fail(`${where}: option ${option.label} is empty`);
      continue;
    }
    if (option.text.length > 400) {
      fail(
        `${where}: option ${option.label} is ${option.text.length} characters (possible swallowed passage)`,
      );
    }
    if (/\bQ\s*\d{1,3}\s*[.)]/.test(option.text)) {
      fail(`${where}: option ${option.label} contains a question marker`);
    }
    if (/\bPassage\s+(?:\d+|[A-Z][A-Za-z'’.-]*\s*:)/.test(option.text)) {
      fail(`${where}: option ${option.label} contains a passage marker`);
    }
    if (/\s\(\d{1,2}\)\s+/.test(option.text) && option.text.length > 150) {
      warn(`${where}: option ${option.label} contains a paragraph marker`);
    }
  }

  const expectedLabels = question.options.map((_, index) => String.fromCharCode(65 + index));
  const actualLabels = question.options.map((option) => option.label);
  if (actualLabels.join('') !== expectedLabels.join('')) {
    warn(`${where}: option labels are not sequential (${actualLabels.join('')})`);
  }

  if (question.correctAnswer && !labels.has(question.correctAnswer)) {
    fail(`${where}: answer ${question.correctAnswer} is not one of the options`);
  }
  if (!question.correctAnswer) {
    warn(`${where}: missing answer key`);
  }

  const expectedRange = passage ? [21, 60] : [61, 100];
  if (
    Number.isFinite(question.sourceNumber) &&
    (question.sourceNumber < 1 || question.sourceNumber > 100)
  ) {
    fail(`${where}: source question number ${question.sourceNumber} is out of range`);
  }
  if (
    Number.isFinite(question.sourceNumber) &&
    question.sourceNumber >= 1 &&
    (question.sourceNumber < expectedRange[0] || question.sourceNumber > expectedRange[1])
  ) {
    warn(
      `${where}: source number ${question.sourceNumber} outside expected ${passage ? 'reading' : 'grammar'} range`,
    );
  }
}

function main() {
  if (!fs.existsSync(BANK_FILE)) {
    console.error(`Bank file not found: ${BANK_FILE}`);
    process.exit(1);
  }

  let bank;
  try {
    bank = JSON.parse(fs.readFileSync(BANK_FILE, 'utf8'));
  } catch (error) {
    console.error(`Could not parse bank JSON: ${error.message}`);
    process.exit(1);
  }

  if (!bank.meta || !bank.catalog || !Array.isArray(bank.models)) {
    console.error('Bank is missing meta, catalog, or models.');
    process.exit(1);
  }

  const modelIds = new Set();
  const questionIds = new Set();
  const passageIds = new Set();
  const allQuestions = [];
  const allPassages = [];
  let emptyPassages = 0;

  for (const model of bank.models) {
    if (modelIds.has(model.id)) fail(`duplicate model id ${model.id}`);
    modelIds.add(model.id);
    if (!Array.isArray(model.reading) || !Array.isArray(model.grammar)) {
      fail(`model ${model.id}: reading/grammar must be arrays`);
      continue;
    }

    let readingIndex = 0;
    let grammarIndex = 0;

    for (const passage of model.reading) {
      if (passageIds.has(passage.id)) fail(`duplicate passage id ${passage.id}`);
      passageIds.add(passage.id);

      if (!passage.text || !passage.text.trim()) {
        emptyPassages++;
      } else if (passage.text.length > 20000) {
        fail(`${passage.id}: passage text is ${passage.text.length} characters`);
      }

      if (!Array.isArray(passage.questions) || passage.questions.length === 0) {
        warn(`${passage.id}: passage has no questions`);
      }

      for (const question of passage.questions) {
        readingIndex++;
        if (questionIds.has(question.id)) fail(`duplicate question id ${question.id}`);
        questionIds.add(question.id);
        if (question.passageId !== passage.id) {
          fail(`${question.id}: passageId does not match ${passage.id}`);
        }
        if (question.id !== `m${model.id}-r${readingIndex}`) {
          fail(`${question.id}: unexpected reading id (expected m${model.id}-r${readingIndex})`);
        }
        checkQuestion(question, model, passage);
        allQuestions.push(question);
        allPassages.push(passage);
      }
    }

    for (const question of model.grammar) {
      grammarIndex++;
      if (questionIds.has(question.id)) fail(`duplicate question id ${question.id}`);
      questionIds.add(question.id);
      if (question.passageId !== null) {
        warn(`${question.id}: grammar question has passageId ${question.passageId}`);
      }
      if (question.id !== `m${model.id}-g${grammarIndex}`) {
        fail(`${question.id}: unexpected grammar id (expected m${model.id}-g${grammarIndex})`);
      }
      checkQuestion(question, model, null);
      allQuestions.push(question);
    }
  }

  const models = bank.models.length;
  const readingQuestions = bank.models.flatMap((model) =>
    model.reading.flatMap((passage) => passage.questions),
  );
  const grammarQuestions = bank.models.flatMap((model) => model.grammar);
  const playable = allQuestions.filter(isPlayable);
  const readingPlayable = readingQuestions.filter(isPlayable);
  const grammarPlayable = grammarQuestions.filter(isPlayable);

  const totals = bank.catalog.totals || {};
  const expectedTotals = {
    models,
    passages: bank.models.reduce((sum, model) => sum + model.reading.length, 0),
    questions: allQuestions.length,
    playable: playable.length,
    reading: readingPlayable.length,
    grammar: grammarPlayable.length,
    answerMissing: allQuestions.filter((question) => !question.correctAnswer).length,
  };

  for (const [key, expected] of Object.entries(expectedTotals)) {
    if (totals[key] !== expected) {
      fail(`catalog.totals.${key} is ${totals[key]}, expected ${expected}`);
    }
    if (bank.meta.totals && bank.meta.totals[key] !== expected) {
      fail(`meta.totals.${key} is ${bank.meta.totals[key]}, expected ${expected}`);
    }
  }

  if (models !== 47) warn(`expected 47 models, found ${models}`);
  if (expectedTotals.playable < 2900) {
    fail(`only ${expectedTotals.playable} playable questions; expected at least 2900`);
  }
  if (emptyPassages > 40) {
    fail(`${emptyPassages} passages have no text; expected image-based passages only`);
  }

  const duplicateSignatures = new Map();
  for (const question of allQuestions) {
    const signature = `${question.text.toLowerCase()}||${question.options
      .map((option) => option.text.toLowerCase())
      .join('|')}`;
    const existing = duplicateSignatures.get(signature);
    if (existing) existing.push(question.id);
    else duplicateSignatures.set(signature, [question.id]);
  }
  const repeatedGroups = [...duplicateSignatures.values()].filter((ids) => ids.length > 1);

  console.log(`Bank:      ${BANK_FILE}`);
  console.log(`Models:    ${models}`);
  console.log(`Passages:  ${expectedTotals.passages} (${emptyPassages} image-based / empty)`);
  console.log(
    `Questions: ${expectedTotals.questions} total, ${expectedTotals.playable} playable ` +
      `(${expectedTotals.reading} reading / ${expectedTotals.grammar} grammar)`,
  );
  console.log(`Missing answers: ${expectedTotals.answerMissing}`);
  console.log(`Repeated question signatures: ${repeatedGroups.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Errors:   ${errors.length}`);

  if (warnings.length) {
    console.log('\nWarnings');
    for (const message of warnings.slice(0, 30)) console.log(`  - ${message}`);
    if (warnings.length > 30) console.log(`  ...and ${warnings.length - 30} more`);
    if (warnings.length) {
      console.log('\nWarnings do not fail validation.');
    }
  }

  if (errors.length) {
    console.error('\nErrors');
    for (const message of errors) console.error(`  - ${message}`);
    console.error(`\nValidation failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log('\nValidation passed.');
}

main();
