// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryGalleryStore } from './memory-gallery.server';

const roots: string[] = [];
async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'shaneweb-memory-gallery-'));
  roots.push(root);
  return { root, store: createMemoryGalleryStore(root) };
}
async function uploadData(category = 'law') {
  const buffer = await sharp({ create: { width: 24, height: 36, channels: 3, background: '#e5eefc' } }).png().toBuffer();
  return { title: '防火避難整理', description: '測試說明', category, dataUrl: `data:image/png;base64,${buffer.toString('base64')}` };
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    // Only remove directories created by this test, never repository/user assets.
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('shaneweb-memory-gallery-')) throw new Error('Unsafe test cleanup');
    await rm(root, { recursive: true, force: true });
  }
});

describe('local memory gallery store', () => {
  it('stores a real image and thumbnail and survives creating a new store instance', async () => {
    const { root, store } = await setup();
    expect(await store.list()).toEqual([]);
    const item = await store.upload(await uploadData());
    expect(item).toMatchObject({ title: '防火避難整理', category: 'law', width: 24, height: 36 });
    for (const src of [item.src, item.thumbnailSrc]) {
      expect((await sharp(await readFile(path.join(root, 'public', src))).metadata()).format).toBe('webp');
    }
    expect(await createMemoryGalleryStore(root).list()).toEqual([item]);
    const manifest = JSON.parse(await readFile(path.join(root, 'data/memory-gallery.json'), 'utf8'));
    expect(manifest.items).toEqual([item]);
    expect(JSON.stringify(manifest)).not.toContain('base64');
  });
  it('serializes simultaneous uploads and retains every category', async () => {
    const { store } = await setup();
    await Promise.all(['law', 'construction', 'env', 'structure'].map(async category => store.upload(await uploadData(category))));
    expect((await store.list()).map(item => item.category).sort()).toEqual(['construction', 'env', 'law', 'structure']);
  });
  it('updates metadata without changing assets, and unlists without deleting the original', async () => {
    const { root, store } = await setup();
    const item = await store.upload(await uploadData());
    const updated = await store.update(item.id, { title: '改為結構', description: '', category: 'structure', src: '../../attack' });
    expect(updated).toMatchObject({ title: '改為結構', category: 'structure', src: item.src, thumbnailSrc: item.thumbnailSrc, createdAt: item.createdAt });
    expect(await createMemoryGalleryStore(root).list()).toEqual([updated]);
    await store.archive(item.id);
    expect(await store.list()).toEqual([]);
    expect((await readFile(path.join(root, 'public', item.src))).length).toBeGreaterThan(0);
    expect(JSON.parse(await readFile(path.join(root, 'data/memory-gallery.json'), 'utf8')).items[0].archivedAt).toBeTruthy();
    await expect(store.update(item.id, { title: 'x', description: '', category: 'law' })).rejects.toMatchObject({ status: 404 });
  });
  it('rejects malicious or malformed upload data and never publishes partial entries', async () => {
    const { store } = await setup();
    const valid = await uploadData();
    for (const dataUrl of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,ZmFrZQ==', 'https://example.com/img.png', 'data:image/png;base64,@@@']) {
      await expect(store.upload({ ...valid, dataUrl })).rejects.toThrow();
    }
    await expect(store.upload({ ...valid, category: '../law' })).rejects.toThrow('請選擇');
    await expect(store.upload({ ...valid, title: '' })).rejects.toThrow('標題');
    await expect(store.archive('../../manifest.json')).rejects.toThrow('編號');
    await expect(store.update('../../manifest.json', valid)).rejects.toThrow('編號');
    expect(await store.list()).toEqual([]);
  });
  it('refuses to overwrite a corrupt index and continues safely after a failed operation', async () => {
    const { root, store } = await setup();
    const valid = await uploadData();
    await expect(store.upload({ ...valid, title: '' })).rejects.toThrow();
    await store.upload(valid);
    const manifest = path.join(root, 'data/memory-gallery.json');
    await writeFile(manifest, 'broken-index');
    await expect(store.upload(valid)).rejects.toThrow();
    expect(await readFile(manifest, 'utf8')).toBe('broken-index');
  });
});
