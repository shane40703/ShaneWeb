import { beforeEach, describe, expect, it } from 'vitest';
import { readEntryTag, readReloadedDepth, writeEntryTag } from './practice-history';

function enter(key: string, method: 'pushState' | 'replaceState' = 'pushState') {
  window.history[method]({ __N: true, key }, '', '/practice');
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('practice history tags', () => {
  it('keeps a tag per Next history key, surviving Next rewriting the entry state', () => {
    enter('first');
    writeEntryTag({ set: 'set-a', depth: 0 });
    enter('second');
    writeEntryTag({ set: 'set-a', depth: 1 });
    // What Next does on Back/Forward: a fresh state object under the same key.
    window.history.replaceState({ __N: true, key: 'first', as: '/practice?q=1' }, '');
    expect(readEntryTag()).toEqual({ set: 'set-a', depth: 0 });
    enter('third');
    expect(readEntryTag()).toBeNull();
  });

  it('clears a tag, and ignores entries without a Next key', () => {
    enter('tagged');
    writeEntryTag({ set: 'set-a', depth: 2 });
    writeEntryTag(null);
    expect(readEntryTag()).toBeNull();
    window.history.pushState(null, '', '/practice');
    writeEntryTag({ set: 'set-a', depth: 1 });
    expect(readEntryTag()).toBeNull();
  });

  it('reuses the last depth after a full load only while the history length is unchanged', () => {
    enter('before-reload');
    writeEntryTag({ set: 'set-a', depth: 3 });
    // A full load: same entry, new key, the old tag unreachable.
    enter('after-reload', 'replaceState');
    expect(readEntryTag()).toBeNull();
    expect(readReloadedDepth('set-a')).toBe(3);
    expect(readReloadedDepth('set-b')).toBe(0);
    enter('elsewhere');
    expect(readReloadedDepth('set-a')).toBe(0);
  });

  it('survives a damaged record', () => {
    window.sessionStorage.setItem('shaneweb:practice-history', '{');
    enter('fresh');
    expect(readEntryTag()).toBeNull();
    expect(readReloadedDepth('set-a')).toBe(0);
    writeEntryTag({ set: 'set-a', depth: 1 });
    expect(readEntryTag()).toEqual({ set: 'set-a', depth: 1 });
  });
});
