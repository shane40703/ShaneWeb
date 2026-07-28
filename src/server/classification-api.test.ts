import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/admin/classification';

function request(
  overrides: Partial<NextApiRequest> = {},
): NextApiRequest {
  return {
    method: 'PATCH',
    headers: {},
    body: {},
    query: {},
    ...overrides,
  } as NextApiRequest;
}

function response() {
  const result = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
  };
  result.status.mockReturnValue(result);
  result.json.mockReturnValue(result);
  return result as unknown as NextApiResponse;
}

afterEach(() => {
  delete process.env.AUTHOR_EDIT_KEY;
});

describe('classification author API', () => {
  it('stays disabled until an author key is configured', async () => {
    const result = response();

    await handler(request(), result);

    expect(result.status).toHaveBeenCalledWith(503);
    expect(result.json).toHaveBeenCalledWith({
      error: '伺服器尚未設定作者編輯金鑰',
    });
  });

  it('rejects a request with the wrong author key', async () => {
    process.env.AUTHOR_EDIT_KEY = 'correct-key';
    const result = response();

    await handler(
      request({ headers: { 'x-author-key': 'wrong-key' } }),
      result,
    );

    expect(result.status).toHaveBeenCalledWith(401);
    expect(result.json).toHaveBeenCalledWith({
      error: '作者編輯金鑰不正確',
    });
  });

  it('validates the update body before touching question files', async () => {
    process.env.AUTHOR_EDIT_KEY = 'correct-key';
    const result = response();

    await handler(
      request({
        headers: { 'x-author-key': 'correct-key' },
        body: {
          questionId: 'law-114-01',
          classifications: [],
        },
      }),
      result,
    );

    expect(result.status).toHaveBeenCalledWith(400);
    expect(result.json).toHaveBeenCalledWith({
      error: '分類資料格式不正確',
    });
  });
});
