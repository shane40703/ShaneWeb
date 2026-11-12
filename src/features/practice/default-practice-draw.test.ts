import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultPracticeDrawStore, DEFAULT_DRAW_HISTORY_KEY } from './default-practice-draw';

const bank = Array.from({ length: 300 }, (_, index) => ({ id: `law-114-${index}` }));
const random = () => 0;

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('default practice draw cycles', () => {
  it('excludes previous questions for five draws, then starts a fresh cycle on the sixth', () => {
    const store = createDefaultPracticeDrawStore();
    const draws = Array.from({ length: 5 }, () => {
      const picked = store.choose('law', bank, 50, random);
      store.record('law', picked.map((item) => item.id));
      return picked.map((item) => item.id);
    });
    expect(new Set(draws.flat()).size).toBe(250);
    const sixth = store.choose('law', bank, 50, random).map((item) => item.id);
    expect(sixth).toEqual(draws[0]);
    store.record('law', sixth);
    expect(JSON.parse(window.localStorage.getItem(DEFAULT_DRAW_HISTORY_KEY)!).law).toEqual([sixth]);
  });

  it('keeps each subject independent and survives creating a new store', () => {
    const first = createDefaultPracticeDrawStore();
    const drawn = first.choose('law', bank, 50, random).map((item) => item.id);
    first.record('law', drawn);
    const next = createDefaultPracticeDrawStore();
    expect(next.choose('law', bank, 50, random).every((item) => !drawn.includes(item.id))).toBe(true);
    expect(next.choose('env', bank, 50, random).map((item) => item.id)).toEqual(drawn);
    next.record('env', ['env-114-1']);
    expect(JSON.parse(window.localStorage.getItem(DEFAULT_DRAW_HISTORY_KEY)!)).toMatchObject({ law: [drawn], env: [['env-114-1']] });
  });

  it('prioritizes unseen items when the pool is too small and never duplicates inside a set', () => {
    const store = createDefaultPracticeDrawStore();
    const small = bank.slice(0, 60);
    const first = store.choose('law', small, 50, random);
    store.record('law', first.map((item) => item.id));
    const second = store.choose('law', small, 50, random);
    const firstIds = new Set(first.map((item) => item.id));
    expect(second.filter((item) => !firstIds.has(item.id))).toHaveLength(10);
    expect(new Set(second.map((item) => item.id)).size).toBe(50);
  });

  it('only advances after recording, and ignores invalid stored data', () => {
    window.localStorage.setItem(DEFAULT_DRAW_HISTORY_KEY, '{bad json');
    const store = createDefaultPracticeDrawStore();
    const first = store.choose('law', bank, 50, random).map((item) => item.id);
    expect(store.choose('law', bank, 50, random).map((item) => item.id)).toEqual(first);
    store.record('law', first);
    expect(store.choose('law', bank, 50, random).map((item) => item.id)).not.toEqual(first);
  });

  it('keeps the cycle in memory if local storage cannot be written', () => {
    const store = createDefaultPracticeDrawStore();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const first = store.choose('law', bank, 50, random).map((item) => item.id);
    store.record('law', first);
    expect(store.choose('law', bank, 50, random).every((item) => !first.includes(item.id))).toBe(true);
  });
});
