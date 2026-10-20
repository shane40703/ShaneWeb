// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
const store = vi.hoisted(() => ({ upload: vi.fn(), update: vi.fn(), archive: vi.fn() }));
vi.mock('./memory-gallery.server', async importOriginal => ({
  ...await importOriginal<typeof import('./memory-gallery.server')>(), memoryGalleryStore: store,
}));
import handler from '@/pages/api/admin/memory-gallery';
import { MemoryGalleryError } from './memory-gallery.server';

function request(overrides: Partial<NextApiRequest> = {}) {
  return { method: 'POST', headers: { 'x-author-key': 'test-author-key', host: 'localhost:3000', origin: 'http://localhost:3000' },
    body: { id: 'example', title: '測試', category: 'law' }, ...overrides } as NextApiRequest;
}
function response() {
  const value = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
  value.status.mockReturnValue(value); value.json.mockReturnValue(value);
  return value as unknown as NextApiResponse;
}
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', ''); vi.stubEnv('AUTHOR_EDIT_KEY', 'test-author-key');
  store.upload.mockReset().mockResolvedValue({ id: 'uploaded' }); store.update.mockReset().mockResolvedValue({ id: 'updated' }); store.archive.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
describe('memory gallery author API', () => {
  it.each(['POST', 'PATCH', 'DELETE'])('requires a key on every %s mutation', async method => {
    const res = response();
    await handler(request({ method, headers: { 'x-author-key': 'wrong' } }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(store.upload).not.toHaveBeenCalled(); expect(store.update).not.toHaveBeenCalled(); expect(store.archive).not.toHaveBeenCalled();
  });
  it.each(['production', 'test'])('blocks filesystem mutations outside development: %s', async environment => {
    vi.stubEnv('NODE_ENV', environment);
    const res = response(); await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(503); expect(store.upload).not.toHaveBeenCalled();
  });
  it('blocks Vercel and requests without a configured key', async () => {
    vi.stubEnv('VERCEL', '1');
    let res = response(); await handler(request(), res); expect(res.status).toHaveBeenCalledWith(503);
    vi.stubEnv('VERCEL', ''); vi.stubEnv('AUTHOR_EDIT_KEY', '');
    res = response(); await handler(request(), res); expect(res.status).toHaveBeenCalledWith(503);
    expect(store.upload).not.toHaveBeenCalled();
  });
  it('rejects foreign origins and unsupported methods', async () => {
    let res = response(); await handler(request({ headers: { 'x-author-key': 'test-author-key', host: 'localhost:3000', origin: 'https://evil.example' } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    res = response(); await handler(request({ method: 'GET' }), res); expect(res.status).toHaveBeenCalledWith(405);
    expect(store.upload).not.toHaveBeenCalled();
  });
  it.each([['POST', 'upload', 201], ['PATCH', 'update', 200], ['DELETE', 'archive', 200]] as const)('accepts authenticated %s', async (method, operation, status) => {
    const res = response(); await handler(request({ method }), res);
    expect(store[operation]).toHaveBeenCalledTimes(1); expect(res.status).toHaveBeenCalledWith(status);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
  it('returns validation errors without exposing filesystem paths or keys', async () => {
    store.upload.mockRejectedValueOnce(new MemoryGalleryError('圖片無效。', 400));
    let res = response(); await handler(request(), res); expect(res.status).toHaveBeenCalledWith(400);
    store.upload.mockRejectedValueOnce(new Error('private-file-path:test-author-key'));
    res = response(); await handler(request(), res); expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(vi.mocked(res.json).mock.calls)).not.toContain('test-author-key');
  });
});
