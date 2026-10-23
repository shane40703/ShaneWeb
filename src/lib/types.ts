import type { SubjectId } from '@/question-bank/schema';

export type { SubjectId };

export type QuestionId = string;

export interface Subject {
  id: SubjectId;
  directory: string;
  name: string;
  shortName: string;
  description: string;
}

export type QuestionContentBlock =
  | { kind: 'text'; text: string }
  | {
      kind: 'image';
      src: string;
      alt: string;
      width: number;
      height: number;
    };

export type AnswerKey =
  | { kind: 'accepted'; options: readonly number[] }
  | { kind: 'all-credit' }
  | { kind: 'written' };

export type QuestionFormat = 'multiple-choice' | 'written';

export type QuestionSource =
  | { kind: 'sample' }
  | {
      kind: 'official';
      paperCode: string;
      page: number;
      questionUrl: string;
      answerUrl: string;
      correctionUrl?: string;
    };

export interface Question {
  id: QuestionId;
  format?: QuestionFormat;
  year: number;
  subject: SubjectId;
  questionNumber: number;
  topic: string;
  primaryCategory: string;
  tags: readonly string[];
  relatedLaws?: readonly string[];
  fineTopic?: string;
  text: string;
  content: readonly QuestionContentBlock[];
  options: readonly string[];
  answerKey: AnswerKey;
  explanation?: string;
  source: QuestionSource;
}

export interface QuestionSummary {
  id: string;
  format?: QuestionFormat;
  subject: SubjectId;
  year: number;
  questionNumber: number;
  primaryCategory: string;
  topic: string;
  tags: readonly string[];
  relatedLaws?: readonly string[];
  fineTopic?: string;
  text: string;
}

export interface AnswerRecord {
  selected: number;
  correct: boolean;
  answeredAt: string;
}

export interface QuizAttempt {
  id: string;
  /** paper: 歷屆試題模擬考 (and the original 歷屆試題); practice: 選擇題練習. */
  mode: 'paper' | 'practice';
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
  authorId?: string;
}

export interface ImageAttachment {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
}

export interface SyncedNote {
  questionId: QuestionId;
  content: string;
  updatedAt: string;
}

export interface DiscussionPost {
  id: string;
  questionId: QuestionId;
  type: DiscussionPostType;
  content: string;
  images: ImageAttachment[];
  createdAt: string;
  likes: number;
  replies: DiscussionReply[];
  reported: boolean;
}

export interface ContentReport {
  id: string;
  pageUrl: string;
  questionId: string;
  category: '題目內容' | '答案' | '圖片' | '詳解' | '其他';
  description: string;
  createdAt: string;
}

export interface AppState {
  answers: Record<QuestionId, AnswerRecord>;
  difficultQuestionIds: QuestionId[];
  attempts: QuizAttempt[];
  deletedAttemptIds: string[];
  notes: Record<QuestionId, string>;
  noteUpdatedAt: Record<QuestionId, string>;
  noteImages: Record<QuestionId, ImageAttachment[]>;
  discussionPosts: DiscussionPost[];
  likedDiscussionPostIds: string[];
  readingPreferences: {
    questionFontSize: number;
    optionFontSize: number;
  };
  contentReports: ContentReport[];
}
