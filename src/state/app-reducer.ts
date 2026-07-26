import type {
  AppState,
  DiscussionPost,
  DiscussionReply,
  ImageAttachment,
  QuizAttempt,
} from '@/lib/types';

export type AppAction =
  | { type: 'hydrate'; state: AppState }
  | { type: 'toggle-difficult'; questionId: string }
  | {
      type: 'save-answer';
      questionId: string;
      selected: number;
      correct: boolean;
      answeredAt: string;
    }
  | { type: 'save-attempt'; attempt: QuizAttempt; results: Record<string, boolean> }
  | { type: 'delete-attempt'; attemptId: string }
  | {
      type: 'save-note';
      questionId: string;
      content: string;
      images?: ImageAttachment[];
    }
  | { type: 'add-discussion-post'; post: DiscussionPost }
  | { type: 'like-discussion-post'; postId: string }
  | { type: 'report-discussion-post'; postId: string }
  | { type: 'add-discussion-reply'; postId: string; reply: DiscussionReply };

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
      };
    }
    case 'delete-attempt':
      return {
        ...state,
        attempts: state.attempts.filter((attempt) => attempt.id !== action.attemptId),
      };
    case 'save-note': {
      const notes = { ...state.notes };
      const noteImages = { ...state.noteImages };
      const content = action.content.trim();
      const images = action.images ?? noteImages[action.questionId] ?? [];
      if (content) notes[action.questionId] = content;
      else delete notes[action.questionId];
      if (images.length) noteImages[action.questionId] = images;
      else delete noteImages[action.questionId];
      return { ...state, notes, noteImages };
    }
    case 'add-discussion-post':
      return { ...state, discussionPosts: [action.post, ...state.discussionPosts] };
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
  }
}
