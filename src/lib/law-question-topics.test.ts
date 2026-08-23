import { describe, expect, it } from 'vitest';
import { getLawQuestionFineTopic, getSimilarLawQuestions } from '@/lib/law-question-topics';
import type { Question } from '@/lib/types';

function lawQuestion(id: string, year: number, text: string): Question {
  return {
    id,
    subject: 'law',
    year,
    questionNumber: 1,
    topic: '建築技術規則',
    primaryCategory: '建築技術規則',
    relatedLaws: ['建築技術規則'],
    tags: [],
    text,
    content: [{ kind: 'text', text }],
    options: ['A', 'B', 'C', 'D'],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

describe('law question fine topics', () => {
  it('distinguishes precise concepts under the same law', () => {
    expect(getLawQuestionFineTopic(lawQuestion('fire', 114, '防火區劃的防火門規定')))
      .toBe('防火區劃與防火間隔');
    expect(getLawQuestionFineTopic(lawQuestion('sound', 114, '分戶牆隔音構造規定')))
      .toBe('建築物隔音構造');
    expect(getLawQuestionFineTopic(lawQuestion('renewal', 114, '都市更新權利變換分配')))
      .toBe('都市更新權利變換');
  });

  it('returns only questions sharing the same fine topic', () => {
    const current = lawQuestion('fire-114', 114, '防火區劃的防火門規定');
    const similar = lawQuestion('fire-113', 113, '防火牆的防火區劃規定');
    const unrelated = lawQuestion('sound-113', 113, '分戶牆隔音構造規定');

    expect(getSimilarLawQuestions(current, [current, similar, unrelated]).questions)
      .toEqual([similar]);
  });
});
