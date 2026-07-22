import type { AppStateV4, DiscussionPost, DiscussionReply, QuizAttempt } from '@/lib/types';

export type AppAction =
  | { type: 'hydrate'; state: AppStateV4 }
  | { type: 'toggle-difficult'; questionId: string }
  | { type: 'save-attempt'; attempt: QuizAttempt; results: Record<string, boolean> }
  | { type: 'save-note'; questionId: string; content: string }
  | { type: 'add-discussion-post'; post: DiscussionPost }
  | { type: 'like-discussion-post'; postId: string }
  | { type: 'report-discussion-post'; postId: string }
  | { type: 'add-discussion-reply'; postId: string; reply: DiscussionReply };

export function appReducer(state: AppStateV4, action: AppAction): AppStateV4 {
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
    case 'save-note': {
      const notes = { ...state.notes };
      if (action.content.trim()) notes[action.questionId] = action.content.trim();
      else delete notes[action.questionId];
      return { ...state, notes };
    }
    case 'add-discussion-post':
      return { ...state, discussionPosts: [action.post, ...state.discussionPosts] };
    case 'like-discussion-post':
      return {
        ...state,
        discussionPosts: state.discussionPosts.map((post) =>
          post.id === action.postId ? { ...post, likes: post.likes + 1 } : post,
        ),
      };
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
