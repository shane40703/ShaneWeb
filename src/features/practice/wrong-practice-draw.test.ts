import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWrongPracticeDrawStore, WRONG_DRAW_HISTORY_KEY } from './wrong-practice-draw';
import { DEFAULT_DRAW_HISTORY_KEY } from './default-practice-draw';

const bank = Array.from({ length: 30 }, (_, index) => ({ id: `law-114-${index}` }));
const counts = Object.fromEntries(bank.map((question, index) => [question.id, index + 1]));
const random = () => 0.5;

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('wrong-question draw cycles', () => {
  it('prioritizes unseen questions for five draws and resets on the sixth', () => {
    const store = createWrongPracticeDrawStore();
    const draws = Array.from({ length: 5 }, () => {
      const result = store.choose('law', bank, counts, 5, random).map((question) => question.id);
      store.record('law', result);
      return result;
    });
    expect(new Set(draws.flat()).size).toBe(25);
    const sixth = store.choose('law', bank, counts, 5, random).map((question) => question.id);
    expect(sixth).toEqual(draws[0]);
    store.record('law', sixth);
    expect(JSON.parse(window.localStorage.getItem(WRONG_DRAW_HISTORY_KEY)!).law).toEqual([sixth]);
  });

  it('uses weights among unseen questions and includes newly added wrong questions', () => {
    const store = createWrongPracticeDrawStore();
    store.record('law', [bank[0].id]);
    const few = bank.slice(0, 3);
    expect(store.choose('law', few, { [few[1].id]: 1, [few[2].id]: 4 }, 1, random))
      .toEqual([few[2]]);
    expect(store.choose('law', few, counts, 2, random).map((question) => question.id))
      .toEqual(expect.arrayContaining([few[1].id, few[2].id]));
  });

  it('fills an undersized pool from seen questions without duplicates within the set', () => {
    const store = createWrongPracticeDrawStore();
    const small = bank.slice(0, 6);
    const first = store.choose('law', small, counts, 5, random);
    store.record('law', first.map((question) => question.id));
    const second = store.choose('law', small, counts, 5, random);
    expect(second.filter((question) => !first.some((item) => item.id === question.id))).toHaveLength(1);
    expect(new Set(second.map((question) => question.id)).size).toBe(5);
  });

  it('keeps subject and daily histories independent, including after remounting', () => {
    window.localStorage.setItem(DEFAULT_DRAW_HISTORY_KEY, JSON.stringify({ law: [['daily']] }));
    const first = createWrongPracticeDrawStore();
    const selected = first.choose('law', bank, counts, 5, random).map((question) => question.id);
    first.record('law', selected);
    const next = createWrongPracticeDrawStore();
    expect(next.choose('law', bank, counts, 5, random).every((question) => !selected.includes(question.id))).toBe(true);
    expect(next.choose('env', bank, counts, 5, random).map((question) => question.id)).toEqual(selected);
    expect(JSON.parse(window.localStorage.getItem(DEFAULT_DRAW_HISTORY_KEY)!)).toEqual({ law: [['daily']] });
  });

  it('supports more than 50 questions and invalid stored history', () => {
    window.localStorage.setItem(WRONG_DRAW_HISTORY_KEY, '{invalid');
    const many = Array.from({ length: 180 }, (_, index) => ({ id: `law-114-${index}` }));
    const store = createWrongPracticeDrawStore();
    const first = store.choose('law', many, {}, 80, random).map((question) => question.id);
    store.record('law', first);
    expect(createWrongPracticeDrawStore().choose('law', many, {}, 80, random).every((question) => !first.includes(question.id))).toBe(true);
  });

  it('does not advance until a draw is recorded and falls back to memory if storage fails', () => {
    const store = createWrongPracticeDrawStore();
    const first = store.choose('law', bank, counts, 5, random).map((question) => question.id);
    expect(store.choose('law', bank, counts, 5, random).map((question) => question.id)).toEqual(first);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    store.record('law', first);
    expect(store.choose('law', bank, counts, 5, random).every((question) => !first.includes(question.id))).toBe(true);
  });
});
