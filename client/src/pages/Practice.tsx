import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Info,
  Layers,
  PenLine,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
  Timer,
  TimerReset,
  X,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../lib/api';
import {
  formatDuration,
  pluralize,
  sectionsLabel,
  cn,
} from '../lib/format';
import {
  getPreferences,
  saveActiveSession,
  savePreferences,
} from '../lib/storage';
import type {
  ActiveTestSession,
  CatalogModel,
  CatalogResponse,
  GenerateTestInput,
  Section,
} from '../types';
import {
  Button,
  InlineAlert,
  NumberStepper,
  PageHeader,
  SectionPill,
  Switch,
} from '../components/ui';

/* `cn` is re-exported from ui.tsx via an import alias to keep markup compact. */

const sectionOptions: Array<{
  value: Section | 'both';
  name: string;
  arabic: string;
  description: string;
  icon: typeof BookOpen;
}> = [
  {
    value: 'both',
    name: 'Both sections',
    arabic: 'القراءة والقواعد',
    description: 'A balanced mix of passages and grammar items.',
    icon: Layers,
  },
  {
    value: 'reading',
    name: 'Reading only',
    arabic: 'القراءة فقط',
    description: 'Passage-based comprehension with a docked reading panel.',
    icon: BookOpen,
  },
  {
    value: 'grammar',
    name: 'Grammar only',
    arabic: 'القواعد فقط',
    description: 'Sentence structure, tenses, vocabulary and usage.',
    icon: PenLine,
  },
];

const timerChoices = [30, 45, 60, 90, 120];

function ModelCard({
  model,
  selected,
  onToggle,
}: {
  model: CatalogModel;
  selected: boolean;
  onToggle: () => void;
}) {
  const hasReading = model.reading.playable > 0;
  const hasGrammar = model.grammar.playable > 0;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'relative flex flex-col rounded-xl border p-3 text-left transition-all duration-150',
        selected
          ? 'border-brand-300 bg-brand-50/60 shadow-[0_0_0_1px_rgba(59,102,246,0.15)]'
          : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50/60',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold text-ink-900">{model.title}</span>
        <span
          className={cn(
            'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition',
            selected
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-ink-300 bg-white text-transparent',
          )}
          style={{ height: '18px', width: '18px' }}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      </span>
      <span className="mt-1.5 flex flex-wrap gap-1.5">
        {hasReading ? (
          <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-inset ring-brand-100">
            R {model.reading.playable}
          </span>
        ) : null}
        {hasGrammar ? (
          <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-mint-700 ring-1 ring-inset ring-mint-100">
            G {model.grammar.playable}
          </span>
        ) : null}
        {!hasReading && !hasGrammar ? (
          <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-400">
            No playable items
          </span>
        ) : null}
      </span>
    </button>
  );
}

function SummaryRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <span className="flex items-center gap-2 text-xs font-semibold text-ink-500">
        {icon}
        {label}
      </span>
      <span className="text-right text-xs font-bold text-ink-900">{value}</span>
    </div>
  );
}

export default function Practice() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const preferences = useMemo(() => getPreferences(), []);

  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<number[]>([]);
  const [sections, setSections] = useState<Section[]>(['reading', 'grammar']);
  const [readingCount, setReadingCount] = useState(10);
  const [grammarCount, setGrammarCount] = useState(10);
  const [timerEnabled, setTimerEnabled] = useState(preferences.timerEnabled);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(
    preferences.secondsPerQuestion,
  );
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .catalog(controller.signal)
      .then((response) => setCatalog(response))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'Could not load the question bank. Is the API running?',
        );
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!catalog || initialized.current) return;
    initialized.current = true;

    const params = new URLSearchParams(location.search);
    const validIds = new Set(catalog.catalog.models.map((model) => model.id));
    const modelParam = params.get('models');
    const parsedModels = modelParam
      ? modelParam
          .split(',')
          .map((value) => Number(value))
          .filter((value) => validIds.has(value))
      : [];
    setSelectedModels(
      parsedModels.length ? [...new Set(parsedModels)] : catalog.catalog.models.map((m) => m.id),
    );

    const sectionParam = params.get('sections');
    let nextSections: Section[] = ['reading', 'grammar'];
    if (sectionParam) {
      const parsed = sectionParam
        .split(',')
        .filter((value): value is Section => value === 'reading' || value === 'grammar');
      if (parsed.length) nextSections = [...new Set(parsed)];
    }
    setSections(nextSections);

    const readingRaw = params.get('reading');
    const grammarRaw = params.get('grammar');
    const readingParam = readingRaw === null ? Number.NaN : Number(readingRaw);
    const grammarParam = grammarRaw === null ? Number.NaN : Number(grammarRaw);
    const defaultReading = nextSections.includes('reading') ? 10 : 0;
    const defaultGrammar = nextSections.includes('grammar') ? 10 : 0;
    setReadingCount(
      Number.isFinite(readingParam) && readingParam >= 0
        ? Math.min(200, readingParam)
        : defaultReading,
    );
    setGrammarCount(
      Number.isFinite(grammarParam) && grammarParam >= 0
        ? Math.min(200, grammarParam)
        : defaultGrammar,
    );

    const secondsParam = Number(params.get('seconds'));
    if (Number.isFinite(secondsParam) && secondsParam >= 10 && secondsParam <= 600) {
      setSecondsPerQuestion(secondsParam);
    }
  }, [catalog, location.search]);

  const selected = useMemo(
    () => catalog?.catalog.models.filter((model) => selectedModels.includes(model.id)) ?? [],
    [catalog, selectedModels],
  );

  const availability = useMemo(
    () => ({
      reading: selected.reduce((sum, model) => sum + model.reading.playable, 0),
      grammar: selected.reduce((sum, model) => sum + model.grammar.playable, 0),
    }),
    [selected],
  );

  const filteredModels = useMemo(() => {
    const models = catalog?.catalog.models ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return models;
    return models.filter(
      (model) =>
        model.title.toLowerCase().includes(term) || String(model.id).includes(term),
    );
  }, [catalog, search]);

  const effectiveReading = sections.includes('reading') ? readingCount : 0;
  const effectiveGrammar = sections.includes('grammar') ? grammarCount : 0;
  const totalQuestions = effectiveReading + effectiveGrammar;
  const totalSeconds = totalQuestions * secondsPerQuestion;

  const computedWarnings = useMemo(() => {
    const messages: string[] = [];
    if (!selectedModels.length) messages.push('Select at least one model to continue.');
    if (!totalQuestions) messages.push('Choose at least one question.');
    if (effectiveReading > 0 && availability.reading < effectiveReading) {
      messages.push(
        `Only ${availability.reading} reading ${pluralize(availability.reading, 'question')} are available from your selection.`,
      );
    }
    if (effectiveGrammar > 0 && availability.grammar < effectiveGrammar) {
      messages.push(
        `Only ${availability.grammar} grammar ${pluralize(availability.grammar, 'question')} are available from your selection.`,
      );
    }
    if (sections.includes('reading') && availability.reading === 0 && selectedModels.length) {
      messages.push('The selected models have no playable reading questions.');
    }
    if (sections.includes('grammar') && availability.grammar === 0 && selectedModels.length) {
      messages.push('The selected models have no playable grammar questions.');
    }
    return messages;
  }, [
    selectedModels.length,
    totalQuestions,
    effectiveReading,
    effectiveGrammar,
    availability,
    sections,
  ]);

  const setSectionMode = (mode: Section | 'both') => {
    if (mode === 'both') {
      setSections(['reading', 'grammar']);
      if (!readingCount) setReadingCount(10);
      if (!grammarCount) setGrammarCount(10);
      return;
    }
    if (mode === 'reading' && readingCount === 0) setReadingCount(10);
    if (mode === 'grammar' && grammarCount === 0) setGrammarCount(10);
    setSections([mode]);
  };

  const applyTotal = (total: number) => {
    if (sections.length === 2) {
      const reading = Math.ceil(total / 2);
      setReadingCount(reading);
      setGrammarCount(total - reading);
    } else if (sections[0] === 'reading') {
      setReadingCount(total);
    } else {
      setGrammarCount(total);
    }
  };

  const toggleModel = (id: number) => {
    setSelectedModels((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const toggleAllModels = () => {
    if (!catalog) return;
    if (selectedModels.length === catalog.catalog.models.length) {
      setSelectedModels([]);
    } else {
      setSelectedModels(catalog.catalog.models.map((model) => model.id));
    }
  };

  const handleGenerate = async () => {
    if (!selectedModels.length) {
      toast.error('Select at least one model', 'Pick one or more models to build a test.');
      return;
    }
    if (!totalQuestions) {
      toast.error('Choose at least one question', 'Increase the reading or grammar count.');
      return;
    }
    if (!sections.length) {
      toast.error('Choose a section', 'Select reading, grammar, or both.');
      return;
    }

    setGenerating(true);
    setWarnings([]);

    const input: GenerateTestInput = {
      modelIds: selectedModels,
      sections,
      readingCount: effectiveReading,
      grammarCount: effectiveGrammar,
      secondsPerQuestion: timerEnabled ? secondsPerQuestion : 60,
    };

    try {
      const { test } = await api.generateTest(input);
      if (!test.questions.length) {
        setWarnings(test.warnings);
        toast.error(
          'No playable questions found',
          test.warnings[0] || 'Try selecting more models or a different section.',
        );
        return;
      }

      const session: ActiveTestSession = {
        test,
        answers: {},
        revealed: [],
        bookmarked: [],
        currentIndex: 0,
        deadline: timerEnabled ? Date.now() + test.totalSeconds * 1000 : null,
        startedAt: new Date().toISOString(),
        untimed: !timerEnabled,
      };
      saveActiveSession(session);
      savePreferences({
        timerEnabled,
        secondsPerQuestion,
      });

      if (test.warnings.length) {
        toast.info(
          'Test created with adjusted counts',
          test.warnings[0],
        );
      }
      navigate(`/test/${test.id}`);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Could not build the test. Please try again.';
      if (error instanceof ApiError && error.warnings) setWarnings(error.warnings);
      toast.error('Test could not be created', message);
    } finally {
      setGenerating(false);
    }
  };

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Practice studio"
          title="Build your test"
          description="Customize models, sections, question count and timing."
        />
        <InlineAlert tone="warn" title="Question bank unavailable">
          {loadError} Make sure the STEPWISE API is running, then refresh this page.
        </InlineAlert>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="space-y-6">
        <div>
          <div className="skeleton h-3 w-24" />
          <div className="skeleton mt-3 h-10 w-72" />
          <div className="skeleton mt-3 h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="skeleton h-64 w-full rounded-3xl" />
            <div className="skeleton h-80 w-full rounded-3xl" />
          </div>
          <div className="skeleton h-80 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  const allSelected = selectedModels.length === catalog.catalog.models.length;
  const timerLabel = timerEnabled
    ? `${formatDuration(totalSeconds)} · ${secondsPerQuestion}s/question`
    : 'Untimed';

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <PageHeader
        eyebrow="Practice studio"
        title="Build your test"
        description="Mix models and sections, choose your question count, then set the pace. Duplicate questions are automatically removed."
        action={
          <div className="flex items-center gap-2">
            <span className="chip">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {selectedModels.length} of {catalog.catalog.models.length} models
            </span>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {/* Sections */}
          <section className="surface p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-950 text-xs font-extrabold text-white">
                1
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-ink-900">Choose sections</h2>
                <p className="text-xs text-ink-400">What do you want to practice today?</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {sectionOptions.map((option) => {
                const isSelected =
                  option.value === 'both'
                    ? sections.length === 2
                    : sections.length === 1 && sections[0] === option.value;
                const showReading = option.value !== 'grammar';
                const showGrammar = option.value !== 'reading';
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSectionMode(option.value)}
                    aria-pressed={isSelected}
                    className={cn(
                      'group relative flex flex-col rounded-2xl border p-3.5 text-left transition-all duration-200',
                      isSelected
                        ? 'border-brand-300 bg-brand-50/60 shadow-[0_0_0_1px_rgba(59,102,246,0.12)]'
                        : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50/50',
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl',
                          isSelected
                            ? 'bg-brand-600 text-white'
                            : 'bg-ink-100 text-ink-500 group-hover:bg-white',
                        )}
                      >
                        <option.icon className="h-4 w-4" />
                      </span>
                      {isSelected ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm font-extrabold text-ink-900">{option.name}</p>
                    <p dir="rtl" lang="ar" className="font-arabic mt-0.5 text-right text-[10px] text-ink-400">
                      {option.arabic}
                    </p>
                    <p className="mt-1.5 hidden text-[11px] leading-relaxed text-ink-500 sm:block">
                      {option.description}
                    </p>
                    <p className="mt-2 text-[10px] font-bold text-ink-400">
                      {showReading ? `${availability.reading} reading` : ''}
                      {showReading && showGrammar ? ' · ' : ''}
                      {showGrammar ? `${availability.grammar} grammar` : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Models */}
          <section className="surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-950 text-xs font-extrabold text-white">
                  2
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-ink-900">Select models</h2>
                  <p className="text-xs text-ink-400">
                    {allSelected
                      ? 'All available STEP models are selected.'
                      : `${selectedModels.length} ${pluralize(selectedModels.length, 'model')} selected.`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleAllModels}
                  className="text-xs font-bold text-brand-700 hover:text-brand-800"
                >
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
                {selectedModels.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedModels([])}
                    className="rounded-md p-1 text-ink-300 transition hover:bg-ink-100 hover:text-ink-600"
                    aria-label="Clear selected models"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a model by number…"
                className="input pl-9"
                aria-label="Search models"
              />
            </div>

            <div className="scroll-slim mt-3 max-h-[300px] overflow-y-auto pr-1">
              {filteredModels.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {filteredModels.map((model) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      selected={selectedModels.includes(model.id)}
                      onToggle={() => toggleModel(model.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-xs text-ink-400">
                  No models match “{search}”.
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-500" />
                {availability.reading} reading questions available
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-mint-500" />
                {availability.grammar} grammar questions available
              </span>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Some source models are missing answer keys. Those items are excluded
              automatically, so counts may differ from the original files.
            </p>
          </section>

          {/* Question mix */}
          <section className="surface p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-950 text-xs font-extrabold text-white">
                3
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-ink-900">Set the question mix</h2>
                <p className="text-xs text-ink-400">
                  Up to 200 questions in a single test.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[10, 20, 40, 60].map((total) => (
                <button
                  key={total}
                  type="button"
                  onClick={() => applyTotal(total)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-bold transition',
                    totalQuestions === total
                      ? 'border-ink-950 bg-ink-950 text-white'
                      : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50',
                  )}
                >
                  {total} questions
                </button>
              ))}
              <span className="self-center text-[11px] text-ink-400">
                {sections.length === 2 ? 'Split evenly across sections' : 'Applied to the selected section'}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div
                className={cn(
                  'rounded-2xl border p-3.5 transition',
                  sections.includes('reading')
                    ? 'border-brand-100 bg-brand-50/40'
                    : 'border-dashed border-ink-200 bg-ink-50/50 opacity-60',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-extrabold text-ink-800">
                    <BookOpen className="h-4 w-4 text-brand-500" /> Reading
                  </span>
                  <SectionPill section="reading" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <NumberStepper
                    value={readingCount}
                    min={0}
                    max={200}
                    step={5}
                    onChange={setReadingCount}
                    ariaLabel="reading questions"
                  />
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                      Available
                    </p>
                    <p className="text-sm font-extrabold tabular-nums text-ink-900">
                      {availability.reading}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
                  {sections.includes('reading')
                    ? 'Questions are grouped by passage so the passage stays on screen.'
                    : 'Enable Reading above to include this section.'}
                </p>
              </div>

              <div
                className={cn(
                  'rounded-2xl border p-3.5 transition',
                  sections.includes('grammar')
                    ? 'border-mint-100 bg-mint-50/40'
                    : 'border-dashed border-ink-200 bg-ink-50/50 opacity-60',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-extrabold text-ink-800">
                    <PenLine className="h-4 w-4 text-mint-500" /> Grammar
                  </span>
                  <SectionPill section="grammar" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <NumberStepper
                    value={grammarCount}
                    min={0}
                    max={200}
                    step={5}
                    onChange={setGrammarCount}
                    ariaLabel="grammar questions"
                  />
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                      Available
                    </p>
                    <p className="text-sm font-extrabold tabular-nums text-ink-900">
                      {availability.grammar}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
                  {sections.includes('grammar')
                    ? 'Sentence completion, structure, tenses and vocabulary.'
                    : 'Enable Grammar above to include this section.'}
                </p>
              </div>
            </div>
          </section>

          {/* Timer */}
          <section className="surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-950 text-xs font-extrabold text-white">
                  4
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-ink-900">Set your pace</h2>
                  <p className="text-xs text-ink-400">
                    One minute per question is the default STEP-style pace.
                  </p>
                </div>
              </div>
              <Switch
                id="timer-enabled"
                checked={timerEnabled}
                onChange={setTimerEnabled}
                label="Countdown timer"
              />
            </div>

            {timerEnabled ? (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {timerChoices.map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      onClick={() => setSecondsPerQuestion(seconds)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs font-bold transition',
                        secondsPerQuestion === seconds
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
                      )}
                    >
                      {seconds < 60 ? `${seconds}s` : `${seconds / 60} min`}
                    </button>
                  ))}
                  <label className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500">
                    Custom
                    <input
                      type="number"
                      min={10}
                      max={600}
                      step={5}
                      value={secondsPerQuestion}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setSecondsPerQuestion(
                          Number.isFinite(value)
                            ? Math.max(10, Math.min(600, value))
                            : 60,
                        );
                      }}
                      className="w-14 border-0 bg-transparent p-0 text-center text-xs font-extrabold tabular-nums text-ink-900 outline-none"
                      aria-label="Custom seconds per question"
                    />
                    s/q
                  </label>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-3.5 py-2.5">
                  <span className="flex items-center gap-2 text-xs font-semibold text-ink-500">
                    <Timer className="h-4 w-4" /> Total time
                  </span>
                  <span className="text-sm font-extrabold tabular-nums text-ink-900">
                    {formatDuration(totalSeconds)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-ink-50 px-3.5 py-3 text-xs text-ink-500">
                <TimerReset className="h-4 w-4 shrink-0" />
                Untimed mode. Your duration is still recorded for your history.
              </div>
            )}
          </section>
        </div>

        {/* Summary */}
        <aside className="hidden md:block">
          <div className="space-y-3 lg:sticky lg:top-[88px]">
            <div className="surface overflow-hidden">
              <div className="bg-ink-950 px-5 py-4 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">
                  Your test
                </p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p className="font-display text-3xl font-medium">{totalQuestions}</p>
                  <p className="pb-1 text-right text-[11px] leading-tight text-ink-400">
                    questions
                    <br />
                    {timerEnabled ? formatDuration(totalSeconds) : 'untimed'}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-ink-100 px-5 py-2">
                <SummaryRow
                  label="Models"
                  value={
                    selectedModels.length === catalog.catalog.models.length
                      ? 'All models'
                      : `${selectedModels.length} selected`
                  }
                  icon={<Layers className="h-3.5 w-3.5 text-ink-400" />}
                />
                <SummaryRow
                  label="Sections"
                  value={sectionsLabel(sections)}
                  icon={<BookOpen className="h-3.5 w-3.5 text-ink-400" />}
                />
                {sections.includes('reading') ? (
                  <SummaryRow
                    label="Reading"
                    value={`${effectiveReading} questions`}
                    icon={<BookOpen className="h-3.5 w-3.5 text-brand-400" />}
                  />
                ) : null}
                {sections.includes('grammar') ? (
                  <SummaryRow
                    label="Grammar"
                    value={`${effectiveGrammar} questions`}
                    icon={<PenLine className="h-3.5 w-3.5 text-mint-400" />}
                  />
                ) : null}
                <SummaryRow
                  label="Pace"
                  value={
                    timerEnabled
                      ? `${secondsPerQuestion}s per question`
                      : 'Untimed practice'
                  }
                  icon={<Clock className="h-3.5 w-3.5 text-ink-400" />}
                />
              </div>

              <div className="px-5 pb-5 pt-2">
                {computedWarnings.length ? (
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-800">
                    <p className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="h-3.5 w-3.5" /> Heads up
                    </p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {computedWarnings.slice(0, 3).map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <Button
                  variant="brand"
                  className="w-full py-3"
                  onClick={handleGenerate}
                  loading={generating}
                  disabled={!selectedModels.length || totalQuestions === 0}
                >
                  {!generating ? <Play className="h-4 w-4" /> : null}
                  <span className="flex flex-col items-center leading-tight">
                    <span>Generate test · {totalQuestions} Q</span>
                    <span dir="rtl" lang="ar" className="font-arabic text-[10px] opacity-70">
                      ابدأ الاختبار
                    </span>
                  </span>
                </Button>
                <p className="mt-2 text-center text-[10px] leading-relaxed text-ink-400">
                  Questions are shuffled and de-duplicated. Answers are scored instantly.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-ink-200 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink-600">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Test-day tip
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
                Use 1 minute per question. If a reading question takes longer, flag it,
                finish the passage, and return with the navigator.
              </p>
            </div>

            {warnings.length ? (
              <InlineAlert tone="warn" title="Generation note">
                {warnings[0]}
              </InlineAlert>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Mobile CTA */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-ink-200/70 bg-white/95 px-4 py-3 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
              {totalQuestions} questions · {timerEnabled ? formatDuration(totalSeconds) : 'untimed'}
            </p>
            <p className="truncate text-xs font-bold text-ink-900">
              {sectionsLabel(sections)} · {selectedModels.length} models
            </p>
          </div>
          <Button
            variant="brand"
            onClick={handleGenerate}
            loading={generating}
            disabled={!selectedModels.length || totalQuestions === 0}
          >
            {!generating ? <Play className="h-4 w-4" /> : null}
            Generate
          </Button>
        </div>
      </div>
    </div>
  );
}
