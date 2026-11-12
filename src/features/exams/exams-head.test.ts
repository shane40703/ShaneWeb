import { describe, expect, it } from 'vitest';
import { examsHubName, examsPlace } from '@/lib/question-path';
import type { Question } from '@/lib/types';
import type { PaperIndex, PaperTopics } from '@/question-bank/derived-data';
import { examsHead, formatCount } from './exams-head';

const paperIndex: PaperIndex = {
  law: [
    [114, 80, 0],
    [113, 80, 0],
  ],
  env: [
    [114, 40, 3],
    [113, 40, 2],
  ],
};

const law114: PaperTopics = {
  subject: 'law',
  year: 114,
  rows: [
    ['law-114-01', ['建築技術規則']],
    ['law-114-02', ['建築法']],
    ['law-114-03', ['建築技術規則', '建築物無障礙設施設計規範']],
    ['law-114-04', ['建築物無障礙設施設計規範']],
    ['law-114-05', ['都市計畫法']],
    ['law-114-06', ['建築技術規則']],
  ],
};

function headAt(slug: string | string[] | undefined, question?: Question) {
  return examsHead(examsPlace(slug), { question, paperIndex, paperTopics: law114 });
}

const question = {
  id: 'law-114-03',
  text: `依建築法規定，\n  公有建築物應由下列何者請領建築執照？`,
} as Question;

describe('examsHead', () => {
  it('names the question and quotes its stem on one line', () => {
    expect(headAt(['law', '114', '3'], question)).toEqual({
      title: '114 年營建法規與實務考古題第 3 題｜建築師考試',
      description:
        '114 年建築師考試營建法規與實務第 3 題：依建築法規定， 公有建築物應由下列何者請領建築執照？',
    });
  });

  it('names a written question as one', () => {
    expect(headAt(['env', '100', 'written-1']).title).toBe(
      '100 年建築環境控制考古題申論第 1 題｜建築師考試',
    );
  });

  it('cuts a long stem', () => {
    const long = { ...question, text: '題'.repeat(200) };
    const { description } = headAt(['law', '114', '3'], long);
    expect(description).toHaveLength('114 年建築師考試營建法規與實務第 3 題：'.length + 111);
    expect(description?.endsWith('…')).toBe(true);
  });

  it('keeps the page description for an image-only question, and after moving on', () => {
    const paper = '114 年建築師考試營建法規與實務考古題，可以逐題作答、看解答和討論。';
    const image = { ...question, text: '' };
    expect(headAt(['law', '114', '3'], image).description).toBe(paper);
    expect(headAt(['law', '114', '4'], question).description).toBe(paper);
  });

  it('names a paper, a subject and the page itself', () => {
    expect(headAt(['law', '114']).title).toBe('114 年營建法規與實務考古題｜建築師考試');
    expect(headAt('law').title).toBe('營建法規與實務考古題｜建築師考試');
    expect(headAt(undefined).title).toBe('歷屆試題討論版｜建築師考試');
    expect(headAt([]).title).toBe('歷屆試題討論版｜建築師考試');
  });

  it('describes 歷屆試題討論版 with what the bank holds', () => {
    expect(headAt(undefined).description).toBe(
      '建築師考試歷屆考古題：營建法規與實務、建築環境控制兩科，民國 113 至 114 年共 4 份試卷、245 題，每一題都可以作答、看解答和討論。',
    );
  });

  it('describes a subject with its papers and both kinds of question', () => {
    expect(headAt('law').description).toBe(
      '建築師考試營建法規與實務歷屆考古題，民國 113 至 114 年共 2 份試卷、選擇題 160 題，每一題都可以作答、看解答和討論。',
    );
    expect(headAt('env').description).toBe(
      '建築師考試建築環境控制歷屆考古題，民國 113 至 114 年共 2 份試卷、申論題 5 題與選擇題 80 題，每一題都可以作答、看解答和討論。',
    );
  });

  it('describes a paper by its most tested topics, once they are here', () => {
    expect(headAt(['law', '114']).description).toBe(
      '114 年建築師考試營建法規與實務考古題，選擇題 80 題，考得最多的是建築技術規則、建築物無障礙設施設計規範與建築法，每一題都可以作答、看解答和討論。',
    );
    // Another paper's topics, or none yet: the sentence goes, the counts stay.
    expect(headAt(['law', '113']).description).toBe(
      '113 年建築師考試營建法規與實務考古題，選擇題 80 題，每一題都可以作答、看解答和討論。',
    );
    expect(
      examsHead(examsPlace(['env', '114']), { paperIndex, paperTopics: null }).description,
    ).toBe(
      '114 年建築師考試建築環境控制考古題，申論題 3 題、選擇題 40 題，每一題都可以作答、看解答和討論。',
    );
  });

  it('quotes no question on an overview, even with one prerendered', () => {
    for (const slug of [undefined, 'law', ['law', '114']]) {
      expect(headAt(slug, question).description).not.toContain('公有建築物');
    }
  });

  it('names each level once, for the tab, the topbar and the way back', () => {
    expect(examsHubName(examsPlace([]))).toBe('歷屆試題討論版');
    expect(examsHubName(examsPlace(['law']))).toBe('營建法規與實務考古題');
    expect(examsHubName(examsPlace(['law', '114']))).toBe('114 年營建法規與實務考古題');
    expect(examsHubName(examsPlace(['law', '114', '3']))).toBe('114 年營建法規與實務考古題');
    expect(formatCount(3672)).toBe('3,672');
    expect(formatCount(80)).toBe('80');
  });
});
