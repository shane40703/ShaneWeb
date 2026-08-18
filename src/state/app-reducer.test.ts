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

  it('does not record random quiz attempts or their answers', () => {
    const paperAttempt = attempt();
    const randomAttempt = { ...paperAttempt, mode: 'random' as const };
    const initial = createDefaultState();
    const state = appReducer(initial, {
      type: 'save-attempt',
      attempt: randomAttempt,
      results: resultsFor(paperAttempt),
    });

    expect(state).toBe(initial);
    expect(state.attempts).toHaveLength(0);
    expect(state.answers).toEqual({});
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
    expect(state.noteUpdatedAt['law-114-01']).toBeTruthy();
    state = appReducer(state, {
      type: 'save-note',
      questionId: 'law-114-01',
      content: ' ',
    });
    expect(state.notes['law-114-01']).toBeUndefined();
    expect(state.noteUpdatedAt['law-114-01']).toBeTruthy();
  });

  it('replaces difficult questions with the deduplicated cloud list', () => {
    const state = appReducer(createDefaultState(), {
      type: 'set-difficult',
      questionIds: ['law-114-01', 'env-114-02', 'law-114-01'],
    });

    expect(state.difficultQuestionIds).toEqual([
      'law-114-01',
      'env-114-02',
    ]);
  });

  it('merges only newer cloud note versions and keeps deletion tombstones', () => {
    const state = createDefaultState();
    state.notes['law-114-01'] = '本機新版';
    state.noteUpdatedAt['law-114-01'] = '2026-08-06T10:00:00.000Z';

    const merged = appReducer(state, {
      type: 'merge-notes',
      notes: [
        {
          questionId: 'law-114-01',
          content: '雲端舊版',
          updatedAt: '2026-08-06T09:00:00.000Z',
        },
        {
          questionId: 'env-114-01',
          content: '雲端筆記',
          updatedAt: '2026-08-06T11:00:00.000Z',
        },
        {
          questionId: 'structure-114-01',
          content: '',
          updatedAt: '2026-08-06T12:00:00.000Z',
        },
      ],
    });

    expect(merged.notes['law-114-01']).toBe('本機新版');
    expect(merged.notes['env-114-01']).toBe('雲端筆記');
    expect(merged.notes['structure-114-01']).toBeUndefined();
    expect(merged.noteUpdatedAt['structure-114-01']).toBe(
      '2026-08-06T12:00:00.000Z',
    );
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
      type: 'edit-discussion-post',
      postId: post.id,
      content: '修改後的內容',
      images: [{
        id: 'replacement-image',
        name: 'replacement.png',
        type: 'image/png',
        dataUrl: 'data:image/png;base64,dGVzdA==',
      }],
    });
    expect(state.discussionPosts[0].content).toBe('修改後的內容');
    expect(state.discussionPosts[0].images[0]?.id).toBe('replacement-image');
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

  it('merges cloud attempts by id and keeps the newest first', () => {
    const local = {
      ...attempt(),
      id: 'attempt-local',
      submittedAt: '2026-01-01T00:00:00.000Z',
    };
    const cloud = {
      ...attempt(1),
      id: 'attempt-cloud',
      submittedAt: '2026-02-01T00:00:00.000Z',
    };
    const state = createDefaultState();
    state.attempts = [local];

    const merged = appReducer(state, {
      type: 'merge-attempts',
      attempts: [local, cloud],
    });

    expect(merged.attempts.map((entry) => entry.id)).toEqual([
      cloud.id,
      local.id,
    ]);
  });

  it('updates reading sizes and lets an administrator remove discussions', () => {
    const post = {
      id: 'post-admin',
      questionId: 'law-114-01',
      type: 'question' as const,
      content: '待刪除',
      images: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      likes: 0,
      replies: [
        {
          id: 'reply-admin',
          content: '待刪除回覆',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      reported: false,
    };
    let state = appReducer(createDefaultState(), {
      type: 'add-discussion-post',
      post,
    });
    state = appReducer(state, {
      type: 'set-reading-font-size',
      target: 'question',
      size: 22,
    });
    state = appReducer(state, {
      type: 'delete-discussion-reply',
      postId: post.id,
      replyId: 'reply-admin',
    });
    expect(state.readingPreferences.questionFontSize).toBe(22);
    expect(state.discussionPosts[0].replies).toEqual([]);

    state = appReducer(state, {
      type: 'delete-discussion-post',
      postId: post.id,
    });
    expect(state.discussionPosts).toEqual([]);
  });

  it('stores and removes content reports', () => {
    const report = {
      id: 'report-test',
      pageUrl: '/questions/law/114/01',
      questionId: 'law-114-01',
      category: '答案' as const,
      description: '答案疑似有誤',
      createdAt: '2026-07-29T00:00:00.000Z',
    };
    let state = appReducer(createDefaultState(), {
      type: 'add-content-report',
      report,
    });
    expect(state.contentReports).toEqual([report]);
    state = appReducer(state, {
      type: 'delete-content-report',
      reportId: report.id,
    });
    expect(state.contentReports).toEqual([]);
  });
});
