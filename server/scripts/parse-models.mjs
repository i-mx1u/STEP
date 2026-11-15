#!/usr/bin/env node
/**
 * STEP question-bank parser
 * -------------------------
 * Reads the local "Model 5" ... "Model 51" text files and produces a normalized,
 * app-friendly JSON bank with passages, questions, options and answer keys.
 *
 * Usage:
 *   node server/scripts/parse-models.mjs
 *   STEP_SOURCE_DIR=/path/to/texts node server/scripts/parse-models.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.resolve(
  process.env.STEP_SOURCE_DIR || path.join(ROOT, 'html', 'models_5_to_51_text'),
);
const OUT_FILE = path.resolve(
  process.env.STEP_BANK_OUT || path.join(ROOT, 'server', 'data', 'step-bank.json'),
);

const Q_PREFIX = /^\s*Q\s*(\d{1,3})\s*[.)\]:-]?\s*(.*)$/i;
const BARE_PREFIX = /^\s*(\d{1,3})\s*[.)]?\s+(.+)$/;
const OPTION = /^\s*([A-Da-d])\s*[).\-:]\s*(.*)$/;
const LONE_OPTION = /^\s*([A-Da-d])\s*$/;
const INLINE_ANSWER = /^\s*ANSWER\s*:\s*\(?([A-D])\)?\s*$/i;
const KEY_ENTRY = /^\s*Q?\s*(\d{1,3})\s*[:.]\s*\(?([A-D])\)?\s*$/i;
const KEY_HEADER = /^\s*ANSWER\s+KEY\b/i;
const PARAGRAPH_MARK = /^\s*\(\d{1,2}\)\s*$/;
const NAMED_PASSAGE = /^\s*Passage\s+[A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*)*\s*:/;
const QUESTION_STARTER =
  /^(?:what|which|according|the\s|why|how|where|when|who|whom|whose|in\s+which|it\s+(?:can|is)|one\s+important|all\s+of|from\s+the|based\s+on)/i;

function looksLikeQuestionPrompt(text) {
  const t = text.trim();
  if (t.length < 8) return false;
  if (/\?/.test(t)) return true;
  if (/(?:_{3,}|…{2,}|\.{3,})/.test(t)) return true;
  return QUESTION_STARTER.test(t) && t.split(/\s+/).length >= 3;
}

function isPlausibleBareStart(line, info, previousLine) {
  // Explicit "Q61." markers are always trustworthy.
  if (/^\s*Q\s*\d/i.test(line)) return true;
  const rest = info.rest.trim();
  if (!rest) return false;
  if (rest.split(/\s+/).length < 2) return false;
  const startsUpper = /^[A-Z0-9"“(]/.test(rest);
  if (startsUpper || looksLikeQuestionPrompt(rest)) return true;
  // Lowercase sentence fragments are only question starts when the previous
  // line closed a sentence or paragraph (not mid-sentence passage prose).
  return /[.!?…:)\]]\s*$/.test(previousLine || '');
}

function normalize(raw) {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

function matchOption(raw) {
  const m = raw.match(OPTION);
  if (!m) return null;
  // Avoid treating initials at the start of prose as option labels,
  // e.g. "B.F. Skinner ..." or "D. H. Lawrence ...".
  if (/^\s*[A-D]\.\s*(?:[A-Z]\.|[A-Za-z]{1,2}\.)/.test(raw)) return null;
  return m;
}

function isPassageMarker(line) {
  return (
    /^\s*[(\[]*\s*(?:-{2,}\s*)?PASSAGE\s+(?:\d+|[A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*)*\s*:)\s*(?:-{2,})?\s*.*$/i.test(
      line,
    ) ||
    /^\s*-{2,}\s*Passage\s*-{2,}\s*$/i.test(line) ||
    /^\s*\(?\s*Passage\s*$/i.test(line)
  );
}

function isPassageSplitPrefix(prefix) {
  return (
    /^[A-Da-d]\s*[).\-:]?\s*$/.test(prefix) ||
    /^[A-Da-d]\s*[).\-:]\s+/.test(prefix) ||
    /[(\-–—:]$/.test(prefix) ||
    /[.!?…]$/.test(prefix)
  );
}

function splitQuestionMarkers(line) {
  if (/^\s*Q\s*\d/i.test(line)) return [line];
  const m = line.match(/^(.*?)\s+(Q\s*\d{1,3}\s*[.)]?)(?:\s+(.*))?$/);
  if (!m || !m[1].trim()) return [line];
  const before = m[1].trimEnd();
  const after = `${m[2]}${m[3] ? ` ${m[3]}` : ''}`.trim();
  return [...splitQuestionMarkers(before), after];
}

function splitPassageMarkers(line) {
  // Some files wrap the marker in stray parentheses, e.g. "(Passage 8".
  let cleaned = line.replace(
    /^(\s*)\(\s*(Passage\s+\d+\b)\s*\(?\s*Passage\s+\d+\b\s*/i,
    '$1$2 ',
  );
  cleaned = cleaned.replace(/^(\s*)\(\s*(Passage\s+(?:\d+|[A-Z]))/i, '$1$2');

  if (isPassageMarker(cleaned)) return [cleaned];

  const numbered = cleaned.match(
    /^(.*?)\s+\(?\s*(Passage\s+(?:\d+\b\s*:?|[A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*)*\s*:))(.*)$/i,
  );
  if (numbered) {
    const before = numbered[1].trim();
    if (before && isPassageSplitPrefix(before)) {
      const rest = `${numbered[2]}${numbered[3] || ''}`.trim();
      return [...splitPassageMarkers(before), ...splitPassageMarkers(rest)];
    }
  }

  // "Passage Psychology: A Behaviorist View" can appear glued to an option.
  const named = cleaned.match(
    /^(.*?[.!?…])\s+(Passage\s+[A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*)*\s*:)(.*)$/,
  );
  if (named) {
    const rest = `${named[2]}${named[3] || ''}`.trim();
    return [...splitPassageMarkers(named[1]), ...splitPassageMarkers(rest)];
  }

  return [cleaned];
}

function splitGluedQuestionNumber(line) {
  const m = line.match(/^(\s*[A-Da-d]\s*[).\-:]\s*)(.*?)\s+(\d{1,3})\s+(.+)$/);
  if (!m) return null;
  const n = Number(m[3]);
  if (n < 21 || n > 100) return null;
  const optionText = m[2].trim();
  const prompt = m[4].trim();
  if (optionText.length > 80 || prompt.length < 12) return null;
  if (!/\?/.test(prompt) && !QUESTION_STARTER.test(prompt)) return null;
  return [`${m[1]}${optionText}`.trimEnd(), `${n} ${prompt}`];
}

function preprocessLines(lines) {
  const out = [];
  for (const line of lines) {
    const withoutQuestions = splitQuestionMarkers(line);
    for (const part of withoutQuestions) {
      for (const passagePart of splitPassageMarkers(part)) {
        const glued = splitGluedQuestionNumber(passagePart);
        if (glued) out.push(...glued);
        else out.push(passagePart);
      }
    }
  }
  return out;
}

function isDecoration(line) {
  const t = line.trim();
  return (
    !t ||
    /^=+$/.test(t) ||
    /^-+$/.test(t) ||
    /^MODEL\s+\d+$/i.test(t) ||
    /^Model\s*$/i.test(t) ||
    /^READING$/i.test(t) ||
    /^GRAMMAR$/i.test(t)
  );
}

function splitSections(lines) {
  const readingIdx = lines.findIndex((l) => /^\s*READING\s*$/i.test(l));
  const grammarIdx = lines.findIndex((l) => /^\s*GRAMMAR\s*$/i.test(l));

  const start = readingIdx >= 0 ? readingIdx + 1 : 0;
  const end = grammarIdx >= 0 ? grammarIdx : lines.length;
  const reading = lines.slice(start, end);
  const grammar = grammarIdx >= 0 ? lines.slice(grammarIdx + 1) : [];

  return {
    reading: trimSection(reading),
    grammar: trimSection(grammar),
  };
}

function trimSection(lines) {
  let a = 0;
  let b = lines.length;
  while (a < b && isDecoration(lines[a])) a++;
  while (b > a && isDecoration(lines[b - 1])) b--;
  return lines.slice(a, b);
}

function splitAnswerKey(lines) {
  const idx = lines.findIndex((l) => KEY_HEADER.test(l));
  if (idx < 0) return { body: lines, keyLines: [] };
  return { body: lines.slice(0, idx), keyLines: lines.slice(idx + 1) };
}

function parseKeyBlock(lines) {
  const map = new Map();
  for (const line of lines) {
    const m = line.match(KEY_ENTRY);
    if (m) {
      const n = Number(m[1]);
      if (!map.has(n)) map.set(n, m[2].toUpperCase());
    }
  }
  return map;
}

function splitPassages(lines) {
  const groups = [];
  let current = {
    label: 'Reading',
    title: '',
    lines: [],
    sourceNumber: null,
  };

  const push = () => {
    if (current.lines.some((l) => l.trim()) || current.sourceNumber) groups.push(current);
  };

  for (const line of lines) {
    let m = line.match(
      /^\s*[(\[]*\s*-{2,}\s*PASSAGE\s+(\d+)\s*:?\s*(.*?)\s*-{2,}\s*[)\]]*\s*$/i,
    );
    if (!m) m = line.match(/^\s*[(\[]*\s*PASSAGE\s+(\d+)\s*:?\s*(.*?)\s*[)\]]*\s*$/i);
    if (!m) m = line.match(/^\s*[(\[]*\s*Passage\s+(\d+)\b\s*(.*)$/i);
    if (m) {
      push();
      current = {
        label: `Passage ${m[1]}`,
        title: (m[2] || '').replace(/^[-)\]]+|[-(\[]+$/g, '').trim(),
        lines: [],
        sourceNumber: Number(m[1]),
      };
      continue;
    }

    // Named passages such as "Passage B: CPU and Memory".
    const named = line.match(
      /^\s*\(?\s*Passage\s+([A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*)*)\s*:\s*(.*)$/,
    );
    if (named) {
      push();
      current = {
        label: `Passage ${named[1]}`,
        title: (named[2] || '').trim(),
        lines: [],
        sourceNumber: null,
      };
      continue;
    }

    // Several files use a bare "Passage" divider, with the title on the next line.
    if (/^\s*\(?\s*Passage\s*\)?\s*$/i.test(line)) {
      push();
      current = { label: 'Passage', title: '', lines: [], sourceNumber: null };
      continue;
    }
    current.lines.push(line);
  }
  push();
  return groups;
}

function questionCandidate(line, mode, range) {
  const q = line.match(Q_PREFIX);
  if (q) {
    const n = Number(q[1]);
    if (n >= 1 && n <= 200) return { n, rest: (q[2] || '').trim() };
  }
  if (mode === 'old') {
    const b = line.match(BARE_PREFIX);
    if (b) {
      const n = Number(b[1]);
      if (n >= range[0] && n <= range[1]) return { n, rest: b[2].trim() };
    }
  }
  return null;
}

function countOptionsAhead(lines, from, maxLook = 40) {
  let count = 0;
  let seen = false;
  const labels = new Set();
  for (let i = from; i < Math.min(lines.length, from + maxLook); i++) {
    const line = lines[i];
    if (i > from && questionCandidate(line, 'new', [0, 999])) break;
    if (i > from && KEY_HEADER.test(line)) break;
    let m = matchOption(line);
    if (m) {
      seen = true;
      labels.add(m[1].toUpperCase());
      continue;
    }
    if (seen) {
      m = line.match(LONE_OPTION);
      if (m) labels.add(m[1].toUpperCase());
    }
  }
  count = labels.size;
  return count;
}

function findQuestionStarts(lines, mode, range) {
  const starts = [];
  let previousLine = '';

  for (let i = 0; i < lines.length; i++) {
    if (KEY_HEADER.test(lines[i])) break;
    const det = questionCandidate(lines[i], mode, range);
    if (det && isPlausibleBareStart(lines[i], det, previousLine)) {
      if (countOptionsAhead(lines, i + 1) >= 2) {
        starts.push({
          index: i,
          sourceNumber: det.n,
          textOverride: det.rest,
          embedded: false,
        });
      }
    }
    if (lines[i].trim()) previousLine = lines[i].trim();
  }

  // Rescue questions that are glued to the previous option line, e.g.
  // "  D) 32 The word cartographer ..." or "  D) 55 What do ... ?"
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*[A-Da-d]\s*[).]\s*(\d{1,3})\s+(.+)$/);
    if (!m) continue;
    const n = Number(m[1]);
    if (n < range[0] || n > range[1]) continue;
    if (!looksLikeQuestionPrompt(m[2])) continue;
    if (starts.some((s) => s.index === i)) continue;
    if (countOptionsAhead(lines, i + 1, 25) < 2) continue;
    starts.push({
      index: i,
      sourceNumber: n,
      textOverride: m[2].trim(),
      embedded: true,
    });
  }

  starts.sort((a, b) => a.index - b.index);
  // Drop duplicate detections of the same line.
  return starts.filter((s, i) => i === 0 || s.index !== starts[i - 1].index);
}

function nextMeaningfulLine(lines, from, end) {
  for (let i = from; i < end; i++) {
    if (lines[i].trim()) return lines[i].trim();
  }
  return null;
}

function looksLikeQuestionLine(line) {
  const t = line.trim();
  return /\?/.test(t) || QUESTION_STARTER.test(t);
}

function cleanOptionText(text) {
  let cleaned = text;
  cleaned = cleaned.split(/\s+Q\s*\d{1,3}\s*[.)]?/i)[0];
  cleaned = cleaned.split(
    /\s+\(?\s*Passage\s+(?:\d+\b|[A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*)*\s*:)/,
  )[0];
  cleaned = cleaned.split(/\s+\(\d{1,2}\)\s+/)[0];
  cleaned = cleaned.split(/\s+(?:ANSWER\s+KEY|MODEL\s+\d+)\b/i)[0];
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  // Anything this long is almost certainly swallowed passage text.
  if (cleaned.length > 400) return '';
  return cleaned;
}

function parseQuestionSegment(lines, start, end, startInfo, mode, range) {
  const textParts = startInfo.textOverride ? [startInfo.textOverride] : [];
  let inlineAnswer = null;
  const optionMap = new Map();
  let seenOption = false;
  let activeLetter = null;

  for (let i = start + 1; i < end; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;
    if (KEY_HEADER.test(line)) break;

    const ans = line.match(INLINE_ANSWER);
    if (ans) {
      inlineAnswer = ans[1].toUpperCase();
      break;
    }

    // A stray question marker or a new passage means this question has ended,
    // even if the next question was too malformed to be detected as a start.
    if (Q_PREFIX.test(line)) break;
    if (isPassageMarker(raw)) break;
    if (seenOption && PARAGRAPH_MARK.test(line)) break;
    const bareBoundary = questionCandidate(line, mode, range);
    if (bareBoundary && (seenOption || looksLikeQuestionLine(line))) break;

    let om = matchOption(raw);
    // A lone "A"/"B"/"C"/"D" line with the option text on the next line.
    if (!om && seenOption) om = raw.match(LONE_OPTION);
    // Some files drop the ")" after the option letter: "B Its function ...".
    if (!om && seenOption) {
      const bare = raw.match(/^\s*([A-D])\s+([A-Z"“(].{4,})$/);
      if (bare) {
        const expected = ['A', 'B', 'C', 'D'].find((l) => !optionMap.has(l));
        if (expected && bare[1] === expected) om = bare;
      }
    }
    // A lone "A" label can open the option list too.
    if (!om && !seenOption && LONE_OPTION.test(raw)) {
      const next = nextMeaningfulLine(lines, i + 1, end);
      if (next && matchOption(next)) om = raw.match(LONE_OPTION);
    }

    if (!om && seenOption) {
      // Passage titles are often left unmarked right before the first "(1)"
      // paragraph, e.g. "The fire" followed by "(1)".
      const next = nextMeaningfulLine(lines, i + 1, end);
      if (next && PARAGRAPH_MARK.test(next) && line.length < 120) break;
    }

    if (om) {
      const letter = om[1].toUpperCase();
      const text = (om[2] || '').trim();
      // Ignore a duplicate label block once that option already has text. The
      // second block is usually leftover passage text rather than an option.
      const existing = optionMap.get(letter);
      if (existing) {
        if (!existing.parts.join('').trim()) {
          if (text) existing.parts.push(text);
          activeLetter = letter;
        } else {
          activeLetter = null;
        }
      } else {
        optionMap.set(letter, { letter, parts: text ? [text] : [] });
        activeLetter = letter;
      }
      seenOption = true;
      continue;
    }

    if (seenOption) {
      if (activeLetter && optionMap.has(activeLetter)) {
        optionMap.get(activeLetter).parts.push(line);
      }
    } else {
      textParts.push(line);
    }
  }

  const options = [...optionMap.values()]
    .map((o) => ({
      letter: o.letter,
      text: cleanOptionText(o.parts.join(' ')),
    }))
    .filter((o) => o.text);

  // Re-label options by appearance order. Handles duplicate/missing letters.
  const relabeled = options.slice(0, 6).map((o, idx) => ({
    label: String.fromCharCode(65 + idx),
    text: o.text,
  }));

  const text = textParts.join(' ').replace(/\s+/g, ' ').trim();
  return {
    text,
    options: relabeled,
    inlineAnswer,
    valid: Boolean(text) && relabeled.length >= 2,
  };
}

function parseQuestions(lines, mode, range, startNumber, answerKey = new Map()) {
  const starts = findQuestionStarts(lines, mode, range);
  const questions = [];
  let displayNumber = startNumber;

  for (let idx = 0; idx < starts.length; idx++) {
    const info = starts[idx];
    const end = idx + 1 < starts.length ? starts[idx + 1].index : lines.length;
    const parsed = parseQuestionSegment(lines, info.index, end, info, mode, range);
    if (!parsed.valid) continue;

    const fromKey = answerKey.get(info.sourceNumber) || null;
    const rawAnswer = parsed.inlineAnswer || fromKey || null;
    // Keep the bank internally consistent: an answer key that points at a
    // missing/misparsed option is treated as missing rather than invalid.
    const hasAnswerOption =
      rawAnswer && parsed.options.some((option) => option.label === rawAnswer);
    const correctAnswer = hasAnswerOption ? rawAnswer : null;
    questions.push({
      id: null,
      number: displayNumber++,
      sourceNumber: info.sourceNumber,
      text: parsed.text,
      options: parsed.options,
      correctAnswer,
      keySource: correctAnswer
        ? parsed.inlineAnswer
          ? 'inline'
          : 'answer-key'
        : rawAnswer
          ? 'unmatched-option'
          : null,
      startLine: info.index,
      endLine: end,
    });
  }
  return questions;
}

function cleanPassage(lines, consumed) {
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      if (kept.length && kept[kept.length - 1] !== '') kept.push('');
      continue;
    }
    if (isDecoration(line)) {
      if (/^(ANSWER|MODEL|READING|GRAMMAR)/i.test(t)) continue;
      if (/^[-=]+$/.test(t)) continue;
      continue;
    }
    if (INLINE_ANSWER.test(t)) continue;
    // Remove orphan markers such as "Q50." left after an unparsable question.
    if (/^Q\s*\d{1,3}\s*[.)]?\s*$/i.test(t)) continue;
    kept.push(t);
  }

  while (kept.length && kept[kept.length - 1] === '') kept.pop();
  let text = kept.join('\n');

  // Reject "passages" that are really just an orphan set of question options.
  const nonEmpty = kept.filter(Boolean);
  const optionish = nonEmpty.filter((l) => matchOption(l) || LONE_OPTION.test(l)).length;
  const questionish = nonEmpty.filter((l) => Q_PREFIX.test(l) || BARE_PREFIX.test(l)).length;
  if (
    nonEmpty.length <= 8 &&
    (optionish >= 2 || questionish >= 2) &&
    text.length < 700
  ) {
    text = '';
  }

  return text.trim();
}

function consumedSet(questions, groupStart) {
  const set = new Set();
  for (const q of questions) {
    for (let i = q.startLine; i < q.endLine; i++) set.add(groupStart + i);
  }
  return set;
}

function parseReading(bodyLines, mode, answerKey) {
  const groups = splitPassages(bodyLines);
  const result = [];

  for (const g of groups) {
    const questions = parseQuestions(g.lines, mode, [21, 60], 21, answerKey);
    if (!questions.length) continue;
    const consumed = consumedSet(questions, 0);
    const text = cleanPassage(g.lines, consumed);
    result.push({
      id: null,
      label: g.label,
      title: g.title,
      sourceNumber: g.sourceNumber,
      text,
      questions,
    });
  }
  return result;
}

function parseGrammar(bodyLines, mode, answerKey) {
  return parseQuestions(bodyLines, mode, [61, 100], 61, answerKey);
}

const normalizeForMatch = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function signature(q) {
  return `${normalizeForMatch(q.text)}||${q.options
    .map((o) => normalizeForMatch(o.text))
    .join('|')}`;
}

function propagateAnswers(models) {
  const byText = new Map();
  const eachQuestion = (model, visit) => {
    for (const passage of model.reading) {
      for (const q of passage.questions) visit(q);
    }
    for (const q of model.grammar) visit(q);
  };

  for (const model of models) {
    eachQuestion(model, (q) => {
      if (!q.correctAnswer) return;
      const key = normalizeForMatch(q.text);
      if (!key) return;
      if (!byText.has(key)) byText.set(key, []);
      byText.get(key).push(q);
    });
  }

  let recovered = 0;
  for (const model of models) {
    eachQuestion(model, (q) => {
      if (q.correctAnswer || q.options.length !== 4) return;
      const candidates = byText.get(normalizeForMatch(q.text)) || [];
      let found = null;

      for (const cand of candidates) {
        if (cand.options.length !== 4) continue;
        const correctOption = cand.options.find((o) => o.label === cand.correctAnswer);
        if (!correctOption) continue;
        const targetText = normalizeForMatch(correctOption.text);
        if (!targetText) continue;

        const target = q.options.filter((o) => normalizeForMatch(o.text) === targetText);
        const targetSet = new Set(q.options.map((o) => normalizeForMatch(o.text)));
        const candSet = new Set(cand.options.map((o) => normalizeForMatch(o.text)));
        let common = 0;
        for (const t of targetSet) if (candSet.has(t)) common++;

        if (target.length === 1 && (common === 4 || common >= 3)) {
          found = target[0].label;
          break;
        }
      }

      if (found) {
        q.correctAnswer = found;
        q.keySource = 'duplicate-question';
        recovered++;
      }
    });
  }
  return recovered;
}

function buildModel(modelNumber, raw, sourceFile) {
  const normalized = normalize(raw).split('\n');
  const lines = preprocessLines(normalized);
  const { reading: readingLines, grammar: grammarLines } = splitSections(lines);
  const isNewFormat = modelNumber >= 49;
  const mode = isNewFormat ? 'new' : 'old';

  const readingSplit = splitAnswerKey(readingLines);
  const grammarSplit = splitAnswerKey(grammarLines);
  const readingKey = parseKeyBlock(readingSplit.keyLines);
  const grammarKey = parseKeyBlock(grammarSplit.keyLines);

  const passages = parseReading(readingSplit.body, mode, readingKey);
  const grammar = parseGrammar(grammarSplit.body, mode, grammarKey);

  let pIndex = 0;
  let rIndex = 0;
  for (const passage of passages) {
    pIndex++;
    passage.id = `m${modelNumber}-p${pIndex}`;
    for (const q of passage.questions) {
      q.id = `m${modelNumber}-r${rIndex + 1}`;
      q.number = 21 + rIndex;
      q.passageId = passage.id;
      rIndex++;
    }
  }

  grammar.forEach((q, idx) => {
    q.id = `m${modelNumber}-g${idx + 1}`;
    q.number = 61 + idx;
    q.passageId = null;
  });

  return {
    id: modelNumber,
    title: `Model ${modelNumber}`,
    sourceFile,
    reading: passages,
    grammar,
  };
}

function playable(q) {
  return (
    Boolean(q.correctAnswer) &&
    q.options.length === 4 &&
    q.options.every((o) => o.text.trim()) &&
    Boolean(q.text.trim()) &&
    q.options.some((o) => o.label === q.correctAnswer)
  );
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => /^model[\s_-]*\d+\.txt$/i.test(f))
    .map((f) => ({ file: f, n: Number(f.match(/\d+/)[0]) }))
    .filter((x) => x.n >= 5 && x.n <= 51)
    .sort((a, b) => a.n - b.n);

  if (!files.length) {
    console.error('No model files found.');
    process.exit(1);
  }

  const models = [];
  const parseReport = [];

  for (const { file, n } of files) {
    const raw = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8');
    const model = buildModel(n, raw, file);
    models.push(model);
  }

  const recovered = propagateAnswers(models);

  for (const model of models) {
    const readingQ = model.reading.flatMap((p) => p.questions);
    parseReport.push({
      file: model.sourceFile,
      model: model.id,
      passages: model.reading.length,
      reading: readingQ.length,
      grammar: model.grammar.length,
      playableReading: readingQ.filter(playable).length,
      playableGrammar: model.grammar.filter(playable).length,
      withoutAnswers: [...readingQ, ...model.grammar].filter((q) => !q.correctAnswer).length,
    });
  }

  const allReading = models.flatMap((m) => m.reading);
  const allQuestions = models.flatMap((m) => [
    ...m.reading.flatMap((p) => p.questions),
    ...m.grammar,
  ]);
  const playableAll = allQuestions.filter(playable);

  const catalog = {
    totals: {
      models: models.length,
      passages: allReading.length,
      questions: allQuestions.length,
      playable: playableAll.length,
      reading: playableAll.filter((q) => q.passageId).length,
      grammar: playableAll.filter((q) => !q.passageId).length,
      answerMissing: allQuestions.filter((q) => !q.correctAnswer).length,
    },
    models: models.map((m) => {
      const reading = m.reading.flatMap((p) => p.questions);
      return {
        id: m.id,
        title: m.title,
        reading: {
          total: reading.length,
          playable: reading.filter(playable).length,
          passages: m.reading.length,
        },
        grammar: {
          total: m.grammar.length,
          playable: m.grammar.filter(playable).length,
        },
      };
    }),
  };

  const bank = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceDir: SOURCE_DIR,
      recoveredAnswers: recovered,
      totals: catalog.totals,
    },
    catalog,
    models,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(bank), 'utf8');

  console.log(`Parsed ${models.length} models -> ${OUT_FILE}`);
  console.log(
    `Questions: ${catalog.totals.questions} total, ${catalog.totals.playable} playable ` +
      `(${catalog.totals.reading} reading / ${catalog.totals.grammar} grammar), ` +
      `${catalog.totals.passages} passages.`,
  );
  console.log(`Recovered ${recovered} answers from duplicate questions.`);
  const weak = parseReport.filter((r) => r.playableReading + r.playableGrammar === 0);
  if (weak.length) console.warn('Models with no playable questions:', weak.map((r) => r.file));
  console.table(
    parseReport.map((r) => ({
      file: r.file,
      passages: r.passages,
      reading: `${r.playableReading}/${r.reading}`,
      grammar: `${r.playableGrammar}/${r.grammar}`,
      noKey: r.withoutAnswers,
    })),
  );
}

main();
