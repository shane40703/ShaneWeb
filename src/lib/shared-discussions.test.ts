import { describe, expect, it } from 'vitest';
import {
  parseCloudDiscussionPost,
  parseCloudDiscussionReply,
} from '@/lib/shared-discussions';

const timestamp = {
  toDate: () => new Date('2026-08-05T08:00:00.000Z'),
};

describe('shared discussion parsing', () => {
  it('accepts a published text post and normalizes its public fields', () => {
    expect(
      parseCloudDiscussionPost('post-1', {
        questionId: 'law-114-01',
        type: 'explanation',
        content: '共享詳解',
        authorId: 'user-1',
        authorName: '匿名使用者',
        createdAt: timestamp,
        deleted: false,
      }),
    ).toMatchObject({
      id: 'post-1',
      questionId: 'law-114-01',
      content: '共享詳解',
      createdAt: '2026-08-05T08:00:00.000Z',
      likes: 0,
      replies: [],
      images: [],
    });
  });

  it('hides deleted or malformed posts', () => {
    expect(
      parseCloudDiscussionPost('post-1', {
        questionId: 'law-114-01',
        type: 'explanation',
        content: '',
        authorId: 'user-1',
        createdAt: timestamp,
        deleted: true,
      }),
    ).toBeNull();
    expect(parseCloudDiscussionPost('post-2', { content: '缺少欄位' })).toBeNull();
  });

  it('accepts valid replies and rejects replies without an author', () => {
    expect(
      parseCloudDiscussionReply('reply-1', {
        content: '補充說明',
        authorId: 'user-1',
        createdAt: timestamp,
      }),
    ).toMatchObject({
      id: 'reply-1',
      content: '補充說明',
      authorId: 'user-1',
      createdAt: '2026-08-05T08:00:00.000Z',
    });
    expect(
      parseCloudDiscussionReply('reply-2', {
        content: '沒有作者',
        createdAt: timestamp,
      }),
    ).toBeNull();
  });
});
