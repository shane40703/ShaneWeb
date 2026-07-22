import { describe, expect, it } from 'vitest';
import { createAttempt, createDefaultState } from '@/lib/study';
import { questions } from '@/data/questions';
import { appReducer } from '@/state/app-reducer';

function attempt(index = 0) {
  const question = questions[index % questions.length];
  return createAttempt({
    mode: 'paper',
    source: [question],
    answers: { [question.id]: question.answer },
    startedAt: '2026-01-01T00:00:00.000Z',
    elapsedSeconds: 10,
  });
}

describe('appReducer', () => {
  it('does not add the same attempt twice and records answer correctness', () => {
    const entry = attempt();
    const first = appReducer(createDefaultState(), { type: 'save-attempt', attempt: entry });
    const duplicate = appReducer(first, { type: 'save-attempt', attempt: entry });
    expect(duplicate.attempts).toHaveLength(1);
    expect(duplicate.answers['law-114-01']?.correct).toBe(true);
  });

  it('keeps only the newest 100 attempts', () => {
    let state = createDefaultState();
    for (let index = 0; index < 105; index += 1) {
      const entry = { ...attempt(index), id: `attempt-${index}` };
      state = appReducer(state, { type: 'save-attempt', attempt: entry });
    }
    expect(state.attempts).toHaveLength(100);
    expect(state.attempts[0].id).toBe('attempt-104');
    expect(state.attempts.at(-1)?.id).toBe('attempt-5');
  });

  it('toggles difficult questions and saves or removes notes', () => {
    let state = appReducer(createDefaultState(), {
      type: 'toggle-difficult',
      questionId: 'law-114-01',
    });
    state = appReducer(state, {
      type: 'save-note',
      questionId: 'law-114-01',
      content: '採光比例要再確認',
    });
    expect(state.difficultQuestionIds).toEqual(['law-114-01']);
    expect(state.notes['law-114-01']).toBe('採光比例要再確認');
    state = appReducer(state, {
      type: 'save-note',
      questionId: 'law-114-01',
      content: ' ',
    });
    expect(state.notes['law-114-01']).toBeUndefined();
  });

  it('supports discussion likes, replies, and reports', () => {
    const post = createDefaultState().discussionPosts[0];
    let state = appReducer(createDefaultState(), {
      type: 'like-discussion-post',
      postId: post.id,
    });
    state = appReducer(state, {
      type: 'add-discussion-reply',
      postId: post.id,
      reply: { id: 'reply-test', content: '補充內容', createdAt: '2026-01-01T00:00:00.000Z' },
    });
    state = appReducer(state, { type: 'report-discussion-post', postId: post.id });
    const updated = state.discussionPosts.find((candidate) => candidate.id === post.id);
    expect(updated?.likes).toBe(post.likes + 1);
    expect(updated?.replies.at(-1)?.content).toBe('補充內容');
    expect(updated?.reported).toBe(true);
  });
});
