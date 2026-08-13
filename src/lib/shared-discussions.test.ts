import { describe, expect, it } from 'vitest';
import {
  createCloudDiscussionPostData,
  parseCloudDiscussionPost,
  parseCloudDiscussionReply,
  withUploadTimeout,
} from '@/lib/shared-discussions';

const timestamp = {
  toDate: () => new Date('2026-08-05T08:00:00.000Z'),
};

describe('shared discussion parsing', () => {
  it('includes the images field required by Firestore rules for text posts', () => {
    expect(
      createCloudDiscussionPostData({
        questionId: 'law-114-01',
        type: 'explanation',
        content: '純文字詳解',
        images: [],
        authorId: 'user-1',
        createdAt: timestamp,
      }),
    ).toEqual({
      questionId: 'law-114-01',
      type: 'explanation',
      content: '純文字詳解',
      images: [],
      authorId: 'user-1',
      authorName: '匿名使用者',
      createdAt: timestamp,
      deleted: false,
    });
  });

  it('stops waiting when an image upload does not finish', async () => {
    await expect(withUploadTimeout(new Promise(() => undefined), 1)).rejects.toThrow(
      '圖片上傳逾時',
    );
  });

  it('accepts a published text post and normalizes its public fields', () => {
    expect(
      parseCloudDiscussionPost('post-1', {
        questionId: 'law-114-01',
        type: 'explanation',
        content: '共享詳解',
        images: [
          {
            id: 'image-1',
            name: '詳解.png',
            type: 'image/png',
            dataUrl: 'https://storage.example.com/detail.png',
          },
        ],
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
      images: [
        expect.objectContaining({
          name: '詳解.png',
          dataUrl: 'https://storage.example.com/detail.png',
        }),
      ],
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
