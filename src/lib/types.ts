export type SubjectId = 'law' | 'env' | 'construction' | 'structure';

export type PaperStatus = 'all' | 'unanswered' | 'answered' | 'wrong';

export interface Subject {
  id: SubjectId;
  name: string;
  shortName: string;
  symbol: string;
  description: string;
}

export interface Question {
  id: number;
  year: number;
  subject: SubjectId;
  topic: string;
  text: string;
  options: readonly string[];
  answer: number;
  explanation: string;
}

export interface AnswerRecord {
  selected: number;
  correct: boolean;
  answeredAt: string;
}

export interface HistoryEntry extends AnswerRecord {
  id: string;
  questionId: number;
}

export interface Preferences {
  theme: 'light' | 'dark';
  fontScale: 'normal' | 'large';
  sidebarCollapsed: boolean;
  instantFeedback: boolean;
}

export interface AppStateV2 {
  version: 2;
  answers: Record<number, AnswerRecord>;
  difficultQuestionIds: number[];
  history: HistoryEntry[];
  preferences: Preferences;
}

export interface PaperFilters {
  year: number | 'all';
  subject: SubjectId | 'all';
  status: PaperStatus;
}

export interface PracticeFilters {
  subject: SubjectId | 'all';
  fromYear: number;
  toYear: number;
  count: number;
  onlyUnanswered: boolean;
  onlyDifficult: boolean;
}
