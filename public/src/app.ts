// src/app.ts - Main STEP Exam Practice Application

// Types
type Question = {
  id: string;
  text: string;
  options: { letter: string; text: string }[];
  answer: string;
  userAnswer?: string;
  bookmarked: boolean;
  passageId?: string;
  passageText?: string;
  questionNumber: number;
};

type Option = { letter: string; text: string };
type Passage = {
  id: string;
  title: string;
  text: string;
  questions: Question[];
};
type TestConfig = {
  modelIds: number[];
  section: 'reading' | 'grammar' | 'both';
  questionCount: number;
  timerPerQuestion: number;
};
type TestState = {
  currentQuestionIndex: number;
  answers: Map<string, string>;
  bookmarked: Set<string>;
  timer: number;
  totalQuestions: number;
  started: boolean;
  finished: boolean;
  passageMode: boolean;
  timerInterval: number;
};
type TestResult = {
  modelId: number;
  section: string;
  score: number;
  total: number;
  percentage: number;
  timeTaken: number;
  date: Date;
  userAnswers: string[];
  correctAnswers: string[];
};

const STORAGE_KEY = 'step_test_state';
const HISTORY_KEY = 'step_test_history';
const BOOKMARKS_KEY = 'step_bookmarks';

// DOM Elements
const appDiv: HTMLElement = document.getElementById('root')!;

// State
let testState: TestState = {
  currentQuestionIndex: 0,
  answers: new Map(),
  bookmarked: new Set(),
  timer: 60,
  totalQuestions: 0,
  started: false,
  finished: false,
  passageMode: false,
  timerInterval: 0
};

let allQuestions: Question[] = [];
let currentModelId: number | null = null;
let testConfig: TestConfig = {
  modelIds: [],
  section: 'both',
  questionCount: 10,
  timerPerQuestion: 60
};

// API base
const API_BASE = '/api';

// Initialize the application
function init(): void {
  setupEventListeners();
  loadStoredState();
  render();
}

// Load stored state from localStorage
function loadStoredState(): void {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed: TestState = JSON.parse(saved);
    testState = { ...testState, ...parsed };
  }
  
  const bookmarks = localStorage.getItem(BOOKMARKS_KEY);
  if (bookmarks) {
    const parsed = JSON.parse(bookmarks);
    parsed.forEach((id: string) => testState.bookmarked.add(id));
  }
}

// Save state to localStorage
function saveState(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(testState));
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(Array.from(testState.bookmarked)));
}

// Setup event listeners
function setupEventListeners(): void {
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Question navigation
    if (target.classList.contains('nav-btn')) {
      const qIndex = parseInt(target.dataset.index || '');
      goToQuestion(qIndex);
    }
    
    // Bookmark button
    if (target.classList.contains('bookmark-btn')) {
      toggleBookmark();
    }
    
    // Show answer button
    if (target.classList.contains('show-answer-btn')) {
      showAnswer();
    }
    
    // Next question button
    if (target.classList.contains('next-btn')) {
      nextQuestion();
    }
    
    // Finish test
    if (target.classList.contains('finish-btn')) {
      finishTest();
    }
  });
}

// Go to specific question
function goToQuestion(index: number): void {
  if (index < 0 || index >= allQuestions.length) return;
  testState.currentQuestionIndex = index;
  saveState();
  render();
}

// Toggle bookmark
function toggleBookmark(): void {
  const currentQ = allQuestions[testState.currentQuestionIndex];
  if (!currentQ) return;
  
  if (testState.bookmarked.has(currentQ.id)) {
    testState.bookmarked.delete(currentQ.id);
  } else {
    testState.bookmarked.add(currentQ.id);
  }
  saveState();
  render();
}

// Show/hide answer
function showAnswer(): void {
  const currentQ = allQuestions[testState.currentQuestionIndex];
  if (!currentQ) return;
  
  currentQ.userAnswer = currentQ.answer;
  testState.answers.set(currentQ.id, currentQ.answer);
  saveState();
  render();
}

// Go to next question
function nextQuestion(): void {
  if (testState.finished) return;
  
  const currentQ = allQuestions[testState.currentQuestionIndex];
  if (currentQ) {
    testState.answers.set(currentQ.id, currentQ.userAnswer || '');
  }
  
  if (testState.currentQuestionIndex < allQuestions.length - 1) {
    testState.currentQuestionIndex++;
    startTimer();
  } else {
    finishTest();
  }
  
  saveState();
  render();
}

// Finish the test
function finishTest(): void {
  testState.finished = true;
  testState.started = false;
  clearInterval(testState.timerInterval);
  testState.timerInterval = 0;
  saveState();
  render();
  showResults();
}

// Show test results
function showResults(): void {
  let correct = 0;
  let answered = 0;
  
  allQuestions.forEach(q => {
    if (testState.answers.has(q.id)) {
      answered++;
      if (testState.answers.get(q.id) === q.answer) {
        correct++;
      }
    }
  });
  
  const score = allQuestions.length > 0 ? Math.round((correct / allQuestions.length) * 100) : 0;
  
  // Save result to history
  const result: TestResult = {
    modelId: currentModelId!,
    section: testConfig.section,
    score,
    total: allQuestions.length,
    percentage: score,
    timeTaken: new Date().getTime() - (testState.timer * 1000),
    date: new Date(),
    userAnswers: allQuestions.map(q => testState.answers.get(q.id) || ''),
    correctAnswers: allQuestions.map(q => q.answer)
  };
  
  let history: TestResult[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  history.push(result);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  
  // Show results UI
  appDiv.innerHTML = `
    <div class="max-w-2xl mx-auto p-6">
      <h1 class="text-3xl font-bold mb-6">Test Complete!</h1>
      <div class="bg-gray-100 rounded p-6 mb-6">
        <p class="text-4xl font-bold">${score}%</p>
        <p class="text-gray-600">Score</p>
      </div>
      <div class="space-y-4">
        <p>Correct: ${correct} / ${allQuestions.length}</p>
        <p>Time Taken: ${Math.floor((new Date().getTime() - result.timeTaken) / 60000)}m ${Math.floor(((new Date().getTime() - result.timeTaken) % 60000) / 1000)}s</p>
        <button id="view-history-btn" class="btn-primary w-full">View Test History</button>
        <button id="retake-btn" class="btn-primary">Retake Test</button>
      </div>
    </div>
  `;
  
  document.getElementById('view-history-btn')!.addEventListener('click', () => renderHistory());
  document.getElementById('retake-btn')!.addEventListener('click', init);
}

// Render the application
function render(): void {
  if (testState.finished) {
    showResults();
    return;
  }
  
  if (!testState.started) {
    renderStartScreen();
    return;
  }
  
  const currentQ = allQuestions[testState.currentQuestionIndex];
  if (!currentQ) return;
  
  // Calculate timer remaining
  let remaining = testState.timer;
  
  appDiv.innerHTML = `
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <header class="border-b border-gray-200 pb-4 mb-6">
        <div class="flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-bold">STEP Exam Practice - Model ${currentModelId}</h1>
            <p class="text-gray-600">Section: ${testConfig.section.toUpperCase()}</p>
          </div>
          <div class="timer-display text-right">
            <span id="timer" class="text-3xl font-bold">${remaining}s</span>
          </div>
        </div>
      </header>
      
      <!-- Question Navigation Grid -->
      <div class="grid grid-cols-6 gap-2 mb-4">
        ${Array.from({ length: allQuestions.length }, (_, i) => {
          const q = allQuestions[i];
          const isCurrent = i === testState.currentQuestionIndex;
          const isAnswered = testState.answers.has(q.id);
          const isBookmarked = testState.bookmarked.has(q.id);
          const isCorrect = isAnswered && testState.answers.get(q.id) === q.answer;
          
          return `
            <button class="nav-btn ${isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'} rounded text-sm px-2 py-1 transition-colors ${isCorrect ? 'bg-green-200' : ''}" data-index="${i}">
              ${i + 1}
            </button>
          `;
        }).join('')}
      </div>
      
      <!-- Question Area -->
      <div class="question-area p-4 bg-white rounded mb-6">
        <!-- Passage mode for reading -->
        ${testState.passageMode && currentQ.passageId ? `
          <div class="passage-sticky mb-4">
            <div class="passage-text min-h-[300px] bg-gray-50 rounded p-4 mb-4">
              ${currentQ.passageText || 'Passage text here...'}
            </div>
          </div>
        ` : ''}
        
        <div class="question-card">
          <h2 class="question-number mb-4 text-lg font-bold">${currentQ.id}: ${currentQ.text}</h2>
          
          ${currentQ.options.map((opt, i) => `
            <div class="option ${testState.answers.has(currentQ.id) && testState.answers.get(currentQ.id) === opt.letter ? 'bg-green-100' : ''} ${testState.bookmarked.has(currentQ.id) ? 'border-yellow-300' : ''} rounded p-3 mb-2 cursor-pointer select-none" 
                 onclick="selectOption('${currentQ.id}', '${opt.letter}')">
              <span class="option-letter font-bold">${opt.letter})</span>
              <span class="option-text ml-2">${opt.text}</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Control Buttons -->
      <div class="control-buttons mt-4 flex gap-2">
        <button class="btn ${testState.currentQuestionIndex > 0 ? '' : 'opacity-50 cursor-not-pending'}" onclick="goToQuestion(${testState.currentQuestionIndex - 1})">
          Prev
        </button>
        <button class="btn bookmark-btn flex items-center gap-2 px-3 py-1.5 ${testState.bookmarked.has(currentQ.id) ? 'bg-yellow-200' : 'bg-gray-200'}" onclick="toggleBookmark()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h3v6h-3v-6zm-11-2h2v2h2v-2h2v-2h-2v-2zm-2 6h2v2H7v-2zm-6 4h2v3h2V7h2v2h2V5h-2V3H9v2zm6-8c-3.3 0-6 2.7-6 6v6h12V5c-3.3 0-6 2.7-6 6z"/>
          </svg>
          Bookmark
        </button>
        <button class="btn show-answer-btn flex-1 ${testState.answers.has(currentQ.id) ? 'opacity-50' : ''}" onclick="showAnswer()">
          ${testState.answers.has(currentQ.id) ? 'Answer Shown' : 'Show Answer'}
        </button>
        <button class="btn next-btn ${testState.currentQuestionIndex < allQuestions.length - 1 ? '' : 'disabled'}" onclick="nextQuestion()">
          ${testState.currentQuestionIndex < allQuestions.length - 1 ? 'Next' : 'Finish'}
        </button>
      </div>
    </div>
  `;
  
  // Initialize timer
  startTimer();
}

// Select an option
function selectOption(questionId: string, optionLetter: string): void {
  const currentQ = allQuestions.find(q => q.id === questionId);
  if (!currentQ) return;
  
  testState.answers.set(questionId, optionLetter);
  saveState();
  render();
}

// Start the timer
function startTimer(): void {
  if (!testState.started) return;
  
  // Clear any existing interval
  if (testState.timerInterval) {
    clearInterval(testState.timerInterval);
  }
  
  testState.timer = testConfig.timerPerQuestion;
  const timerEl: HTMLElement = document.getElementById('timer')!;
  if (timerEl) {
    timerEl.textContent = `${testState.timer}s`;
  }
  
  testState.timerInterval = window.setInterval(() => {
    testState.timer--;
    const timerEl: HTMLElement = document.getElementById('timer')!;
    if (timerEl) {
      timerEl.textContent = `${testState.timer}s`;
    }
    
    if (testState.timer <= 0) {
      clearInterval(testState.timerInterval);
      testState.timerInterval = 0;
      nextQuestion();
    }
  }, 1000);
}

// Render start screen
function renderStartScreen(): void {
  fetch('/api/models')
    .then(response => response.json())
    .then(models => {
      let options = '';
      models.forEach((m: any) => {
        options += `<option value="${m.id}">Model ${m.id}</option>`;
      });
      
      appDiv.innerHTML = `
        <div class="max-w-2xl mx-auto p-8 text-center">
          <h1 class="text-4xl font-bold mb-6">STEP Exam Practice</h1>
          <div class="bg-white rounded p-8 max-w-md mx-auto border">
            <h2 class="text-2xl font-semibold mb-6">Test Configuration</h2>
            
            <form id="config-form" class="space-y-4">
              <div>
                <label class="block text-gray-700 mb-2">Select Models:</label>
                <select id="model-select" multiple class="w-full p-2 border rounded" multiple>
                  ${options}
                </select>
              </div>
              
              <div>
                <label class="block text-gray-700 mb-2">Section Type:</label>
                <div class="flex space-x-4">
                  <label><input type="radio" name="section" value="reading" class="mr-2"> Reading Only</label>
                  <label><input type="radio" name="section" value="grammar" class="mr-2"> Grammar Only</label>
                  <label><input type="radio" name="section" value="both" checked class="mr-2"> Both</label>
                </div>
              </div>
              
              <div>
                <label class="block text-gray-700 mb-2">Questions per Test:</label>
                <input type="number" id="question-count" min="1" max="200" value="${testConfig.questionCount}" class="w-full p-2 border rounded">
              </div>
              
              <div>
                <label class="block text-gray-700 mb-2">Timer (seconds per question):</label>
                <input type="number" id="timer-per-question" min="10" max="300" value="${testConfig.timerPerQuestion}" class="w-full p-2 border rounded">
                <p class="text-gray-500 text-sm mt-1">Default: 60 seconds</p>
              </div>
              
              <div>
                <button type="submit" class="btn-primary w-full">Start Test</button>
              </div>
            </form>
          </div>
        </div>
      `;
      
      const configForm: HTMLFormElement = document.getElementById('config-form') as HTMLFormElement;
configForm.addEventListener('submit', startTest);
    })
    .catch(err => {
      console.error('Error fetching models:', err);
      appDiv.innerHTML = '<p class="text-center p-8">Error loading models. Please try again.</p>';
    });
}

// Start the test
function startTest(e: Event): void {
  e.preventDefault();
  
  const modelSelect: HTMLSelectElement = document.getElementById('model-select') as HTMLSelectElement;
  const section = (document.querySelector('input[name="section"]:checked') as HTMLInputElement).value || 'both';
  const questionCount = parseInt((document.getElementById('question-count') as HTMLInputElement).value) || 10;
  const timerPerQuestion = parseInt((document.getElementById('timer-per-question') as HTMLInputElement).value) || 60;
  
  const selectedModels = Array.from(modelSelect.selectedOptions).map(o => parseInt(o.value));
  
  if (selectedModels.length === 0) {
    alert('Please select at least one model');
    return;
  }
  
  testConfig.modelIds = selectedModels;
  testConfig.section = (section as 'reading' | 'grammar' | 'both');
  testConfig.questionCount = questionCount;
  testConfig.timerPerQuestion = timerPerQuestion;
  
  // Load questions from backend
  fetch(`${API_BASE}/models/${selectedModels[0]}/section?section=${section}`)
    .then(response => response.json())
    .then(data => {
      let questions: Question[] = [];
      
      // Process reading passages
      if (testConfig.section === 'reading' || testConfig.section === 'both') {
        data.passages.forEach((passage: any) => {
          passage.questions.forEach((q: any) => {
            questions.push({
              id: q.number || `q${questions.length}`,
              text: q.text || '',
              options: q.options || [],
              answer: q.answer || '',
              userAnswer: undefined,
              bookmarked: false,
              passageId: passage.id,
              passageText: passage.text || '',
              questionNumber: q.number ? parseInt(q.number.replace('Q', '')) : questions.length + 1
            });
          });
        });
      }
      
      // Process grammar questions
      if (testConfig.section === 'grammar' || testConfig.section === 'both') {
        data.questions.forEach((q: { number: any; text: any; options: any; answer: any }) => {
          questions.push({
            id: q.number || `q${questions.length}`,
            text: q.text || '',
            options: q.options || [],
            answer: q.answer || '',
            userAnswer: undefined,
            bookmarked: false,
            passageId: undefined,
            passageText: '',
            questionNumber: questions.length + 1
          });
        });
      }
      
      // Limit to questionCount
      allQuestions = questions.slice(0, questionCount);
      
      // Initialize test state
      testState = {
        currentQuestionIndex: 0,
        answers: new Map(),
        bookmarked: new Set(),
        timer: timerPerQuestion,
        totalQuestions: allQuestions.length,
        started: true,
        finished: false,
        passageMode: testConfig.section === 'reading',
        timerInterval: 0
      };
      
      saveState();
      render();
    })
    .catch(err => {
      console.error('Error loading test:', err);
      alert('Error loading test. Please try again.');
    });
}

// Render test history
function renderHistory(): void {
  const history: TestResult[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  
  if (history.length === 0) {
    appDiv.innerHTML = '<p class="text-center p-8">No test history found.</p>';
    return;
  }
  
  let html = `<div class="max-w-2xl mx-auto p-6">
    <h1 class="text-3xl font-bold mb-6">Test History</h1>
    <div class="space-y-4">`;
    
  history.forEach((result: TestResult, index) => {
    html += `
      <div class="bg-gray-100 rounded p-4">
        <h2>Model ${result.modelId} - ${result.section.toUpperCase()}</h2>
        <p>Score: ${result.percentage}% (${result.score}/${result.total})</p>
        <p>Date: ${result.date.toLocaleDateString()}</p>
        <button class="btn-primary w-full mt-2" onclick="showDetail(${index})">View Details</button>
      </div>
    `;
  });
  
  html += `</div></div>`;
  
  appDiv.innerHTML = html;
}

function showDetail(index: number): void {
  const history: TestResult[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  const result = history[index];
  
  if (!result) return;
  
  appDiv.innerHTML = `
    <div class="max-w-2xl mx-auto p-6">
      <h1 class="text-3xl font-bold mb-6">Test Details: Model ${result.modelId}</h1>
      <div class="bg-white rounded p-6 mb-6">
        <p>Score: <span class="text-2xl font-bold">${result.percentage}%</span></p>
        <p>Time: ${Math.floor(result.timeTaken / 60000)}m ${Math.floor((result.timeTaken % 60000) / 1000)}s</p>
      </div>
      
      <div class="space-y-4">
        <p>Correct: ${result.score} / ${result.total}</p>
        <p>Percentage: ${result.percentage}%</p>
      </div>
      
      <button id="back-to-history" class="btn-primary" onclick="renderHistory()">Back to History</button>
    </div>
  `;
}

// Initialize the app
init();