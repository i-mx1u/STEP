"use strict";
// src/app.ts - Main STEP Exam Practice Application
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const API_BASE = '/api';
// DOM Elements
const appDiv = document.getElementById('root');
// State
let testState = {
    currentQuestionIndex: 0,
    answers: new Map(),
    bookmarked: new Set(),
    timer: 60, // Default 1 minute per question
    totalQuestions: 0,
    started: false,
    finished: false,
    passageMode: false
};
let allQuestions = [];
let currentModelId = null;
let testConfig = {
    modelIds: [],
    section: 'both',
    questionCount: 10,
    timerPerQuestion: 60
};
// Initialize the application
function init() {
    setupEventListeners();
    loadStoredState();
    render();
}
// Load stored state from localStorage
function loadStoredState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        const parsed = JSON.parse(saved);
        testState = { ...testState, ...parsed };
    }
    const history = localStorage.getItem(HISTORY_KEY);
    if (history) {
        // Load history if needed
    }
    const bookmarks = localStorage.getItem(BOOKMARKS_KEY);
    if (bookmarks) {
        const parsed = JSON.parse(bookmarks);
        parsed.forEach((id) => testState.bookmarked.add(id));
    }
}
// Save state to localStorage
function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(testState));
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(Array.from(testState.bookmarked)));
}
// Setup event listeners
function setupEventListeners() {
    // Navigation buttons
    document.addEventListener('click', (e) => {
        const target = e.target;
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
        // Timer control
        if (target.classList.contains('timer-btn')) {
            toggleTimer();
        }
    });
}
// Go to specific question
function goToQuestion(index) {
    if (index < 0 || index >= allQuestions.length)
        return;
    testState.currentQuestionIndex = index;
    saveState();
    render();
}
// Toggle bookmark
function toggleBookmark() {
    const currentQ = allQuestions[testState.currentQuestionIndex];
    if (!currentQ)
        return;
    if (testState.bookmarked.has(currentQ.id)) {
        testState.bookmarked.delete(currentQ.id);
    }
    else {
        testState.bookmarked.add(currentQ.id);
    }
    saveState();
    render();
}
// Show/hide answer
function showAnswer() {
    const currentQ = allQuestions[testState.currentQuestionIndex];
    if (!currentQ)
        return;
    currentQ.userAnswer = currentQ.answer;
    testState.answers.set(currentQ.id, currentQ.answer);
    saveState();
    render();
}
// Go to next question
function nextQuestion() {
    if (testState.finished)
        return;
    const currentQ = allQuestions[testState.currentQuestionIndex];
    if (currentQ) {
        testState.answers.set(currentQ.id, currentQ.userAnswer || '');
    }
    if (testState.currentQuestionIndex < allQuestions.length - 1) {
        testState.currentQuestionIndex++;
        startTimer();
    }
    else {
        finishTest();
    }
    saveState();
    render();
}
// Finish the test
function finishTest() {
    testState.finished = true;
    testState.started = false;
    saveState();
    render();
    showResults();
}
// Show test results
function showResults() {
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
    const result = {
        modelId: currentModelId,
        section: testConfig.section,
        score,
        total: allQuestions.length,
        percentage: score,
        timeTaken: new Date().getTime() - (testState.timer * 1000),
        date: new Date(),
        userAnswers: allQuestions.map(q => testState.answers.get(q.id) || ''),
        correctAnswers: allQuestions.map(q => q.answer)
    };
    let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
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
        <p>Time Taken: ${Math.floor(result.timeTaken / 60000)}m ${Math.floor((result.timeTaken % 60000) / 1000)}s</p>
        <button id="view-history-btn" class="btn-primary">View Test History</button>
        <button id="retake-btn" class="btn-primary">Retake Test</button>
      </div>
    </div>
  `;
    document.getElementById('view-history-btn').addEventListener('click', renderHistory);
    document.getElementById('retake-btn').addEventListener('click', initTest);
}
// Render the application
function render() {
    if (testState.finished) {
        showResults();
        return;
    }
    if (!testState.started) {
        renderStartScreen();
        return;
    }
    const currentQ = allQuestions[testState.currentQuestionIndex];
    if (!currentQ)
        return;
    // Calculate timer
    let remaining = testState.timer;
    if (testState.started) {
        // Timer is managed by setInterval in startTimer
    }
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
      </div>
      
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
      <div class="question-area">
        <!-- Passage mode for reading -->
        ${testState.passageMode && currentQ.passageId ? `
          <div class="passage-sticky mb-6">
            <div class="passage-text min-h-[300px]">
              ${currentQ.passageText || ''}
            </div>
            <div class="passage-questions">
              ${currentQ.questionNumber > 0 ? `Question ${currentQ.questionNumber}` : 'Reading Questions'}
            </div>
          </div>
        ` : ''}
        
        <div class="question-card">
          <h2 class="question-number mb-4">${currentQ.id}: ${currentQ.text}</h2>
          
          ${currentQ.options.map((opt, i) => `
            <div class="option ${testState.answers.has(currentQ.id) && testState.answers.get(currentQ.id) === opt.letter ? 'bg-green-100' : ''} ${testState.bookmarked.has(currentQ.id) ? 'border-yellow-300' : ''} rounded p-3 mb-2 cursor-pointer select-none" 
                 onclick="selectOption('${currentQ.id}', '${opt.letter}')">
              <span class="option-letter ${testState.answers.has(currentQ.id) && testState.answers.get(currentQ.id) !== opt.letter ? 'font-bold' : ''}">${opt.letter})</span>
              <span class="option-text ml-2">${opt.text}</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Control Buttons -->
      <div class="control-buttons mt-6 flex gap-3">
        <button class="btn ${testState.currentQuestionIndex > 0 ? '' : 'opacity-50 cursor-not-pending'}" onclick="goToQuestion(${testState.currentQuestionIndex - 1})">
          Prev Question
        </button>
        <button class="btn ${testState.bookmarked.has(currentQ.id) ? 'bg-yellow-200' : 'bg-gray-200'} bookmark-btn flex items-center gap-2 px-4 py-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h3v6h-3v-6zm-11-2h2v2h2v-2h2v-3h-2v-2h-2v3h-2v2zm-2 6h2v2H7v-2zm-6 4h2v3h2V7h2v2h2V5h-2V3H9v2zm6-8c-3.3 0-6 2.7-6 6v6h12V5c-3.3 0-6 2.7-6 6z"/>
          </svg>
          Bookmark
        </button>
        <button class="btn show-answer-btn flex-1">${testState.answers.has(currentQ.id) ? 'Answer Shown' : 'Show Answer'}</button>
        <button class="btn next-btn ${testState.currentQuestionIndex < allQuestions.length - 1 ? '' : 'disabled'}" onclick="nextQuestion()">
          ${testState.currentQuestionIndex < allQuestions.length - 1 ? 'Next Question' : 'Finish Test'}
        </button>
      </div>
      
      ${testState.started ? `
        <div class="mt-6 timer-control">
          <button class="timer-btn btn ${testState.timer > 0 ? 'bg-yellow-100' : 'bg-gray-200'}">
            ${testState.timer > 0 ? 'Timer: On' : 'Timer: Paused'}
          </button>
        </div>
      ` : ''}
    </div>
  `;
    // Initialize timer
    startTimer();
}
// Select an option
function selectOption(questionId, optionLetter) {
    testState.answers.set(questionId, optionLetter);
    saveState();
    render();
}
// Start the timer
function startTimer() {
    if (!testState.started)
        return;
    // Clear any existing interval
    if (testState.timerInterval) {
        clearInterval(testState.timerInterval);
    }
    let elapsed = 0;
    testState.timerInterval = setInterval(() => {
        testState.timer--;
        document.getElementById('timer').textContent = `${testState.timer}s`;
        if (testState.timer <= 0) {
            clearInterval(testState.timerInterval);
            nextQuestion();
        }
    }, 1000);
}
// Render start screen
function renderStartScreen() {
    appDiv.innerHTML = `
    <div class="max-w-2xl mx-auto p-8 text-center">
      <h1 class="text-4xl font-bold mb-6">STEP Exam Practice</h1>
      <div class="bg-white rounded p-8 max-w-md mx-auto border">
        <h2 class="text-2xl font-semibold mb-6">Test Configuration</h2>
        
        <form id="config-form" class="space-y-4">
          <div>
            <label class="block text-gray-700 mb-2">Select Models:</label>
            <select id="model-select" multiple class="w-full p-2 border rounded" multiple>
              ${getModelOptions()}
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
            <input type="number" id="question-count" min="1" max="100" value="${testConfig.questionCount}" class="w-full p-2 border rounded">
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
    document.getElementById('config-form').addEventListener('submit', startTest);
}
function getModelOptions() {
    // Fetch models from API or use predefined
    // For now, use models 5-51
    let options = '';
    for (let i = 5; i <= 51; i++) {
        options += `<option value="${i}">Model ${i}</option>`;
    }
    return options;
}
// Start the test
async function startTest(e) {
    e.preventDefault();
    const modelSelect = document.getElementById('model-select');
    const section = document.querySelector('input[name="section"]:checked')?.value || 'both';
    const questionCount = parseInt(document.getElementById('question-count').value) || 10;
    const timerPerQuestion = parseInt(document.getElementById('timer-per-question').value) || 60;
    const selectedModels = Array.from(modelSelect.selectedOptions).map(o => parseInt(o.value));
    if (selectedModels.length === 0) {
        alert('Please select at least one model');
        return;
    }
    testConfig.modelIds = selectedModels;
    testConfig.section = section;
    testConfig.questionCount = questionCount;
    testConfig.timerPerQuestion = timerPerQuestion;
    // Load questions from backend
    try {
        const response = await fetch(`${API_BASE}/models/${selectedModels[0]}/section?section=${section}`);
        const data = await response.json();
        // Process questions from reading and grammar sections
        let questions = [];
        if (section === 'reading' || section === 'both') {
            // Use reading passages
            data.passages.forEach((passage) => {
                passage.questions.forEach((q) => {
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
        if (section === 'grammar' || section === 'both') {
            // Use grammar questions
            data.questions.forEach((q) => {
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
            passageMode: section === 'reading'
        };
        saveState();
        render();
    }
    catch (error) {
        console.error('Error loading test:', error);
        alert('Error loading test. Please try again.');
    }
}
// Render test history
function renderHistory() {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (history.length === 0) {
        appDiv.innerHTML = `<p class="text-center p-8">No test history found.</p>`;
        return;
    }
    let html = `<div class="max-w-2xl mx-auto p-6">
    <h1 class="text-3xl font-bold mb-6">Test History</h1>
    <div class="space-y-4">`;
    history.forEach((result, index) => {
        html += `
      <div class="bg-gray-100 rounded p-4">
        <h2>Model ${result.modelId} - ${result.section.toUpperCase()}</h2>
        <p>Score: ${result.percentage}% (${result.score}/${result.total})</p>
        <p>Date: ${result.date.toLocaleDateString()}</p>
        <button class="btn-primary w-full mt-2 view-detail-btn" data-index="${index}">View Details</button>
      </div>
    `;
    });
    html += `</div></div>`;
    appDiv.innerHTML = html;
    // Add event listeners for detail buttons
    document.querySelectorAll('.view-detail-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            showDetail(history[idx]);
        });
    });
}
function showDetail(result) {
    appDiv.innerHTML = `
    <div class="max-w-2xl mx-auto p-6">
      <h1 class="text-3xl font-bold mb-6">Test Details: Model ${result.modelId}</h1>
      <div class="bg-white rounded p-6 mb-6">
        <p>Score: <span class="text-2xl font-bold">${result.percentage}%</span></p>
        <p>Time: ${Math.floor(result.timeTaken / 60000)}m ${Math.floor((result.timeTaken % 60000) / 1000)}s</p>
      </div>
      
      <div class="space-y-4" id="questions-detail">
        <!-- Questions will be populated by API -->
      </div>
      
      <button id="back-to-history" class="btn-primary">Back to History</button>
    </div>
  `;
    document.getElementById('back-to-history').addEventListener('click', renderHistory);
}
//# sourceMappingURL=app.js.map