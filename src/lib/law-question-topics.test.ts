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

  it('returns only questions sharing the same fine topic, newest year first', () => {
    const current = lawQuestion('fire-114', 114, '防火區劃的防火門規定');
    const older = lawQuestion('fire-101', 101, '防火門的防火區劃規定');
    const similar = lawQuestion('fire-113', 113, '防火牆的防火區劃規定');
    const later = { ...lawQuestion('fire-114-9', 114, '防火捲門的防火區劃規定'), questionNumber: 9 };
    const unrelated = lawQuestion('sound-113', 113, '分戶牆隔音構造規定');

    expect(getSimilarLawQuestions(current, [older, current, similar, unrelated, later]))
      .toEqual({ topic: '防火區劃與防火間隔', questions: [later, similar, older], total: 3 });
  });

  it('lists every matching question instead of the nearest few', () => {
    const current = lawQuestion('fire-114', 114, '防火區劃的防火門規定');
    const siblings = Array.from({ length: 9 }, (_, index) =>
      lawQuestion(`fire-${100 + index}`, 100 + index, '防火區劃的防火門規定'),
    );

    const result = getSimilarLawQuestions(current, [current, ...siblings]);
    expect(result.total).toBe(9);
    expect(result.questions.map((question) => question.year))
      .toEqual([108, 107, 106, 105, 104, 103, 102, 101, 100]);
  });

  it('prefers a manually assigned fine topic over keyword detection', () => {
    const manual = {
      ...lawQuestion('manual', 114, '防火區劃的防火門規定'),
      fineTopic: '人工指定考點',
    };

    expect(getLawQuestionFineTopic(manual)).toBe('人工指定考點');
  });
});
