export interface Question {
    id: string;
    text: string;
    options: Option[];
    answer: string;
    userAnswer?: string;
    bookmarked: boolean;
    passageId?: string;
    questionNumber: number;
}
export interface Option {
    letter: string;
    text: string;
}
export interface Passage {
    id: string;
    title: string;
    text: string;
    questions: Question[];
}
export interface TestConfig {
    modelIds: number[];
    section: 'reading' | 'grammar' | 'both';
    questionCount: number;
    timerPerQuestion: number;
}
export interface TestState {
    currentQuestionIndex: number;
    answers: Map<string, string>;
    bookmarked: Set<string>;
    timer: number;
    totalQuestions: number;
    started: boolean;
    finished: boolean;
    passageMode: boolean;
}
export interface TestResult {
    modelId: number;
    section: string;
    score: number;
    total: number;
    percentage: number;
    timeTaken: number;
    date: Date;
    userAnswers: string[];
    correctAnswers: string[];
}
//# sourceMappingURL=types.d.ts.map