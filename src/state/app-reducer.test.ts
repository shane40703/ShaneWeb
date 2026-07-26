import { describe, expect, it } from 'vitest';
import { createAttempt, createDefaultState, isQuestionCorrect } from '@/lib/study';
import { loadAllQuestions } from '@/server/question-bank.server';
import { appReducer } from '@/state/app-reducer';

const questions = await loadAllQuestions();

function attempt(index = 0) {
  const question = questions[index % questions.length];
  const selected = question.answerKey.kind === 'accepted' ? question.answerKey.options[0] : 0;
  return createAttempt({
    mode: 'paper',
    source: [question],
    answers: { [question.id]: selected },
    startedAt: '2026-01-01T00:00:00.000Z',
    elapsedSeconds: 10,
  });
}

function resultsFor(entry: ReturnType<typeof attempt>) {
  return Object.fromEntries(
    Object.entries(entry.answers).map(([questionId, selected]) => {
      const question = questions.find((candidate) => candidate.id === questionId);
      return [questionId, question ? isQuestionCorrect(question, selected) : false];
    }),
  );
}

describe('appReducer', () => {
  it('records an answer without adding an unfinished attempt', () => {
    const state = appReducer(createDefaultState(), {
      type: 'save-answer',
      questionId: 'law-114-01',
      selected: 1,
      correct: false,
      answeredAt: '2026-07-23T00:00:00.000Z',
    });

    expect(state.answers['law-114-01']).toEqual({
      selected: 1,
      correct: false,
      answeredAt: '2026-07-23T00:00:00.000Z',
    });
    expect(state.attempts).toHaveLength(0);
  });

  it('does not add the same attempt twice and records answer correctness', () => {
    const entry = attempt();
    const results = resultsFor(entry);
    const first = appReducer(createDefaultState(), { type: 'save-attempt', attempt: entry, results });
    const duplicate = appReducer(first, { type: 'save-attempt', attempt: entry, results });
    expect(duplicate.attempts).toHaveLength(1);
    expect(duplicate.answers['law-114-01']?.correct).toBe(true);
  });

  it('keeps only the newest 100 attempts', () => {
    let state = createDefaultState();
    for (let index = 0; index < 105; index += 1) {
      const entry = { ...attempt(index), id: `attempt-${index}` };
      state = appReducer(state, {
        type: 'save-attempt',
        attempt: entry,
        results: resultsFor(entry),
      });
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

  it('deletes only the selected attempt', () => {
    const first = { ...attempt(), id: 'attempt-first' };
    const second = { ...attempt(), id: 'attempt-second' };
    let state = createDefaultState();
    state.attempts = [second, first];
    state = appReducer(state, {
      type: 'delete-attempt',
      attemptId: first.id,
    });
    expect(state.attempts.map((entry) => entry.id)).toEqual([second.id]);
  });

  it('supports discussion likes, replies, and reports', () => {
    const post = {
      id: 'post-test',
      questionId: 'env-114-01',
      type: 'explanation' as const,
      content: '測試內容',
      images: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      likes: 0,
      replies: [],
      reported: false,
    };
    let state = appReducer(createDefaultState(), { type: 'add-discussion-post', post });
    state = appReducer(state, {
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
    expect(state.likedDiscussionPostIds).toContain(post.id);
    expect(updated?.replies.at(-1)?.content).toBe('補充內容');
    expect(updated?.reported).toBe(true);

    state = appReducer(state, {
      type: 'like-discussion-post',
      postId: post.id,
    });
    expect(state.discussionPosts[0].likes).toBe(post.likes);
    expect(state.likedDiscussionPostIds).not.toContain(post.id);
  });
});
