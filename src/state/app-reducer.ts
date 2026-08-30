import type {
  AppState,
  ContentReport,
  DiscussionPost,
  DiscussionReply,
  ImageAttachment,
  QuizAttempt,
  SyncedNote,
} from '@/lib/types';

export type AppAction =
  | { type: 'hydrate'; state: AppState }
  | { type: 'toggle-difficult'; questionId: string }
  | { type: 'set-difficult'; questionIds: string[] }
  | {
      type: 'save-answer';
      questionId: string;
      selected: number;
      correct: boolean;
      answeredAt: string;
    }
  | { type: 'save-attempt'; attempt: QuizAttempt; results: Record<string, boolean> }
  | { type: 'merge-attempts'; attempts: QuizAttempt[] }
  | { type: 'delete-attempt'; attemptId: string }
  | { type: 'remove-synced-attempt'; attemptId: string }
  | { type: 'confirm-attempt-deletion'; attemptId: string }
  | {
      type: 'save-note';
      questionId: string;
      content: string;
      images?: ImageAttachment[];
      updatedAt?: string;
    }
  | { type: 'merge-notes'; notes: SyncedNote[] }
  | { type: 'add-discussion-post'; post: DiscussionPost }
  | {
      type: 'edit-discussion-post';
      postId: string;
      content: string;
      images?: ImageAttachment[];
    }
  | { type: 'like-discussion-post'; postId: string }
  | { type: 'report-discussion-post'; postId: string }
  | { type: 'add-discussion-reply'; postId: string; reply: DiscussionReply }
  | { type: 'delete-discussion-post'; postId: string }
  | { type: 'delete-discussion-reply'; postId: string; replyId: string }
  | {
      type: 'set-reading-font-size';
      target: 'question' | 'option';
      size: number;
    }
  | { type: 'add-content-report'; report: ContentReport }
  | { type: 'delete-content-report'; reportId: string };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'toggle-difficult': {
      const exists = state.difficultQuestionIds.includes(action.questionId);
      return {
        ...state,
        difficultQuestionIds: exists
          ? state.difficultQuestionIds.filter((id) => id !== action.questionId)
          : [...state.difficultQuestionIds, action.questionId],
      };
    }
    case 'set-difficult':
      return {
        ...state,
        difficultQuestionIds: [...new Set(action.questionIds)],
      };
    case 'save-answer':
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.questionId]: {
            selected: action.selected,
            correct: action.correct,
            answeredAt: action.answeredAt,
          },
        },
      };
    case 'save-attempt': {
      if (action.attempt.mode === 'random') return state;
      if (state.attempts.some((attempt) => attempt.id === action.attempt.id)) return state;
      const answers = { ...state.answers };
      for (const [questionId, selected] of Object.entries(action.attempt.answers)) {
        answers[questionId] = {
          selected,
          correct: action.results[questionId] ?? false,
          answeredAt: action.attempt.submittedAt,
        };
      }
      return {
        ...state,
        answers,
        attempts: [action.attempt, ...state.attempts].slice(0, 100),
        deletedAttemptIds: state.deletedAttemptIds.filter(
          (attemptId) => attemptId !== action.attempt.id,
        ),
      };
    }
    case 'merge-attempts': {
      const deletedAttemptIds = new Set(state.deletedAttemptIds);
      const attempts = new Map(
        [...state.attempts, ...action.attempts]
          .filter((attempt) => !deletedAttemptIds.has(attempt.id))
          .map((attempt) => [attempt.id, attempt]),
      );
      return {
        ...state,
        attempts: [...attempts.values()]
          .sort((left, right) =>
            right.submittedAt.localeCompare(left.submittedAt),
          )
          .slice(0, 100),
      };
    }
    case 'delete-attempt':
      return {
        ...state,
        attempts: state.attempts.filter((attempt) => attempt.id !== action.attemptId),
        deletedAttemptIds: [
          action.attemptId,
          ...state.deletedAttemptIds.filter(
            (attemptId) => attemptId !== action.attemptId,
          ),
        ].slice(0, 100),
      };
    case 'confirm-attempt-deletion':
      return {
        ...state,
        deletedAttemptIds: state.deletedAttemptIds.filter(
          (attemptId) => attemptId !== action.attemptId,
        ),
      };
    case 'remove-synced-attempt':
      return {
        ...state,
        attempts: state.attempts.filter(
          (attempt) => attempt.id !== action.attemptId,
        ),
      };
    case 'save-note': {
      const notes = { ...state.notes };
      const noteUpdatedAt = { ...state.noteUpdatedAt };
      const noteImages = { ...state.noteImages };
      const content = action.content.trim();
      const images = action.images ?? noteImages[action.questionId] ?? [];
      if (content) notes[action.questionId] = content;
      else delete notes[action.questionId];
      if (images.length) noteImages[action.questionId] = images;
      else delete noteImages[action.questionId];
      noteUpdatedAt[action.questionId] =
        action.updatedAt ?? new Date().toISOString();
      return { ...state, notes, noteUpdatedAt, noteImages };
    }
    case 'merge-notes': {
      const notes = { ...state.notes };
      const noteUpdatedAt = { ...state.noteUpdatedAt };
      action.notes.forEach((note) => {
        if ((noteUpdatedAt[note.questionId] ?? '') >= note.updatedAt) return;
        if (note.content.trim()) notes[note.questionId] = note.content.trim();
        else delete notes[note.questionId];
        noteUpdatedAt[note.questionId] = note.updatedAt;
      });
      return { ...state, notes, noteUpdatedAt };
    }
    case 'add-discussion-post':
      return { ...state, discussionPosts: [action.post, ...state.discussionPosts] };
    case 'edit-discussion-post':
      return {
        ...state,
        discussionPosts: state.discussionPosts.map((post) =>
          post.id === action.postId
            ? { ...post, content: action.content, images: action.images ?? post.images }
            : post,
        ),
      };
    case 'like-discussion-post': {
      const alreadyLiked = state.likedDiscussionPostIds.includes(action.postId);
      return {
        ...state,
        discussionPosts: state.discussionPosts.map((post) =>
          post.id === action.postId
            ? { ...post, likes: Math.max(0, post.likes + (alreadyLiked ? -1 : 1)) }
            : post,
        ),
        likedDiscussionPostIds: alreadyLiked
          ? state.likedDiscussionPostIds.filter((postId) => postId !== action.postId)
          : [...state.likedDiscussionPostIds, action.postId],
      };
    }
    case 'report-discussion-post':
      return {
        ...state,
        discussionPosts: state.discussionPosts.map((post) =>
          post.id === action.postId ? { ...post, reported: true } : post,
        ),
      };
    case 'add-discussion-reply':
      return {
        ...state,
        discussionPosts: state.discussionPosts.map((post) =>
          post.id === action.postId
            ? { ...post, replies: [...post.replies, action.reply] }
            : post,
        ),
      };
    case 'delete-discussion-post':
      return {
        ...state,
        discussionPosts: state.discussionPosts.filter(
          (post) => post.id !== action.postId,
        ),
        likedDiscussionPostIds: state.likedDiscussionPostIds.filter(
          (postId) => postId !== action.postId,
        ),
      };
    case 'delete-discussion-reply':
      return {
        ...state,
        discussionPosts: state.discussionPosts.map((post) =>
          post.id === action.postId
            ? {
                ...post,
                replies: post.replies.filter(
                  (reply) => reply.id !== action.replyId,
                ),
              }
            : post,
        ),
      };
    case 'set-reading-font-size':
      return {
        ...state,
        readingPreferences: {
          ...state.readingPreferences,
          [action.target === 'question'
            ? 'questionFontSize'
            : 'optionFontSize']: action.size,
        },
      };
    case 'add-content-report':
      return {
        ...state,
        contentReports: [action.report, ...state.contentReports],
      };
    case 'delete-content-report':
      return {
        ...state,
        contentReports: state.contentReports.filter(
          (report) => report.id !== action.reportId,
        ),
      };
  }
}
