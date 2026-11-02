import { describe, expect, it } from 'vitest';
import type { Question } from '@/lib/types';
import { examsHead } from './exams-head';

const question = {
  id: 'law-114-03',
  text: `依建築法規定，\n  公有建築物應由下列何者請領建築執照？`,
} as Question;

describe('examsHead', () => {
  it('names the question and quotes its stem on one line', () => {
    expect(examsHead(['law', '114', '3'], question)).toEqual({
      title: '114 年營建法規與實務考古題第 3 題｜建築師考試',
      description:
        '114 年建築師考試營建法規與實務第 3 題：依建築法規定， 公有建築物應由下列何者請領建築執照？',
    });
  });

  it('names a written question as one', () => {
    expect(examsHead(['env', '100', 'written-1']).title).toBe(
      '100 年建築環境控制考古題申論第 1 題｜建築師考試',
    );
  });

  it('cuts a long stem', () => {
    const long = { ...question, text: '題'.repeat(200) };
    const { description } = examsHead(['law', '114', '3'], long);
    expect(description).toHaveLength('114 年建築師考試營建法規與實務第 3 題：'.length + 111);
    expect(description?.endsWith('…')).toBe(true);
  });

  it('keeps the page description for an image-only question, and after moving on', () => {
    const paper = '114 年建築師考試營建法規與實務考古題，可以逐題作答、看解答和討論。';
    const image = { ...question, text: '' };
    expect(examsHead(['law', '114', '3'], image).description).toBe(paper);
    expect(examsHead(['law', '114', '4'], question).description).toBe(paper);
  });

  it('names a paper, a subject and the page itself', () => {
    expect(examsHead(['law', '114']).title).toBe('114 年營建法規與實務考古題｜建築師考試');
    expect(examsHead('law').title).toBe('營建法規與實務考古題｜建築師考試');
    expect(examsHead('law').description).toContain('民國 100 至 114 年');
    expect(examsHead(undefined)).toEqual({ title: '考古題討論版｜建築師考試' });
  });
});
