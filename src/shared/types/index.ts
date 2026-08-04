export type Role = 'STUDENT' | 'ADMIN';
export type TestStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type Section = 'LISTENING' | 'READING';
export type SessionStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'ABANDONED';
export type QuestionType = 'PHOTO_DESCRIPTION' | 'QUESTION_RESPONSE' | 'CONVERSATION' | 'SHORT_TALK' | 'INCOMPLETE_SENTENCE' | 'TEXT_COMPLETION' | 'READING_COMPREHENSION';

export interface Profile {
  id: string; email: string; firstName: string | null; lastName: string | null;
  avatarUrl: string | null; role: Role; createdAt: string;
}

export interface Option {
  id: string; questionId: string; label: string; content: string;
  isCorrect: boolean; explanation: string | null;
}

export interface Question {
  id: string; partId: string; orderIndex: number; globalIndex: number;
  type: QuestionType; stimulus: string | null; imageUrl: string | null;
  audioUrl: string | null; audioStart: number | null; audioEnd: number | null;
  options: Option[];
}

export interface Part {
  id: string; testId: string; number: number; section: Section;
  title: string; description: string | null; orderIndex: number;
  audioUrl: string | null; questions: Question[];
}

export interface Test {
  id: string; title: string; description: string | null; version: string;
  totalTime: number; status: TestStatus; createdAt: string; parts: Part[];
}

export interface TestSummary {
  id: string; title: string; description: string | null; version: string;
  totalTime: number; createdAt: string; _count: { sessions: number };
}

export interface ExamAnswer { questionId: string; optionId: string | null; isMarked: boolean; }

export interface ExamSession {
  id: string; profileId: string; testId: string; status: SessionStatus;
  currentQuestion: number; timeRemaining: number; startedAt: string; answers: ExamAnswer[];
}

export interface QuestionResult {
  id: string; resultId: string; questionId: string;
  selectedLabel: string | null; correctLabel: string; isCorrect: boolean;
  question: Question & { part: Pick<Part, 'number' | 'section' | 'title'> };
  note: { content: string } | null;
}

export interface Result {
  id: string; profileId: string; testId: string; sessionId: string;
  listeningScore: number; readingScore: number; totalScore: number;
  listeningCorrect: number; readingCorrect: number; totalCorrect: number;
  timeTaken: number; completedAt: string;
  test: { title: string }; questionResults: QuestionResult[];
}

export interface ApiResponse<T> { success: boolean; data: T; message?: string; }