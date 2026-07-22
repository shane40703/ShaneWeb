export type SubjectId = 'law' | 'env' | 'construction' | 'structure';

export type QuestionId = string;

export interface Subject {
  id: SubjectId;
  name: string;
  shortName: string;
  description: string;
}

export interface Question {
  id: QuestionId;
  year: number;
  subject: SubjectId;
  questionNumber: number;
  topic: string;
  primaryCategory: string;
  tags: readonly string[];
  relatedLaws?: readonly string[];
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

export interface QuizAttempt {
  id: string;
  mode: 'paper' | 'random';
  subject: SubjectId | 'mixed';
  year: number | null;
  questionIds: QuestionId[];
  answers: Record<QuestionId, number>;
  startedAt: string;
  submittedAt: string;
  elapsedSeconds: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
}

export type DiscussionPostType =
  | 'explanation'
  | 'supplement'
  | 'question'
  | 'correction';

export interface DiscussionReply {
  id: string;
  content: string;
  createdAt: string;
}

export interface DiscussionPost {
  id: string;
  questionId: QuestionId;
  type: DiscussionPostType;
  content: string;
  createdAt: string;
  likes: number;
  replies: DiscussionReply[];
  reported: boolean;
}

export interface AppStateV3 {
  version: 3;
  answers: Record<QuestionId, AnswerRecord>;
  difficultQuestionIds: QuestionId[];
  attempts: QuizAttempt[];
  notes: Record<QuestionId, string>;
  discussionPosts: DiscussionPost[];
}

export interface PracticeFilters {
  subject: SubjectId | 'all';
  fromYear: number;
  toYear: number;
  count: number;
  onlyUnanswered: boolean;
  onlyDifficult: boolean;
}
