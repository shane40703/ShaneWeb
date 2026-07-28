import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllQuestions } from '@/server/question-bank.server';
import type { Question, SubjectId } from '@/lib/types';

const ANSWER_LABELS = ['A', 'B', 'C', 'D'] as const;
const YEARS = Array.from({ length: 13 }, (_, index) => 102 + index);
const answerInfoRoot = path.join(process.cwd(), 'AnswersInfo');
const sourceBySubject: Record<SubjectId, string> = {
  construction: 'construction',
  env: 'environment',
  law: 'regulations',
  structure: 'structure',
};
const questionCountBySource: Record<string, number> = {
  construction: 80,
  environment: 40,
  regulations: 80,
  structure: 40,
};

function parseAnswerInfo(content: string, source: string, year: number) {
  const entries = content.trim().split(/\r?\n/u).map((line) => {
    const match = /^(\d+)=([A-D]+)$/.exec(line);
    expect(match, `${source}/${year}.txt: ${line}`).not.toBeNull();
    return {
      questionNumber: Number(match![1]),
      answer: match![2],
    };
  });

  expect(entries).toHaveLength(questionCountBySource[source]);
  expect(entries.map((entry) => entry.questionNumber)).toEqual(
    Array.from({ length: entries.length }, (_, index) => index + 1),
  );
  entries.forEach(({ answer }) => {
    expect([...new Set(answer)].join('')).toBe(answer);
    expect([...answer].sort().join('')).toBe(answer);
    expect(
      [...answer].every((label) =>
        ANSWER_LABELS.includes(label as (typeof ANSWER_LABELS)[number]),
      ),
    ).toBe(true);
  });

  return new Map(
    entries.map(({ questionNumber, answer }) => [questionNumber, answer]),
  );
}

function runtimeAnswer(question: Pick<Question, 'answerKey'>) {
  if (question.answerKey.kind === 'all-credit') return 'ABCD';
  return question.answerKey.options
    .map((index) => ANSWER_LABELS[index])
    .join('');
}

describe('AnswersInfo contract', () => {
  it('contains a complete and valid answer file for every subject and year', async () => {
    for (const source of Object.values(sourceBySubject)) {
      const files = (await readdir(path.join(answerInfoRoot, source))).sort();
      expect(files).toEqual(YEARS.map((year) => `${year}.txt`));

      for (const year of YEARS) {
        const content = await readFile(
          path.join(answerInfoRoot, source, `${year}.txt`),
          'utf8',
        );
        parseAnswerInfo(content, source, year);
      }
    }
  });

  it('matches every existing official question without changing sample questions', async () => {
    const questions = await loadAllQuestions();
    const answerFiles = new Map<string, Map<number, string>>();

    for (const source of Object.values(sourceBySubject)) {
      for (const year of YEARS) {
        const content = await readFile(
          path.join(answerInfoRoot, source, `${year}.txt`),
          'utf8',
        );
        answerFiles.set(
          `${source}:${year}`,
          parseAnswerInfo(content, source, year),
        );
      }
    }

    let comparedOfficial = 0;
    let skippedSamples = 0;

    for (const question of questions) {
      if (question.source.kind !== 'official') {
        skippedSamples += 1;
        continue;
      }

      const source = sourceBySubject[question.subject];
      const expected = answerFiles
        .get(`${source}:${question.year}`)
        ?.get(question.questionNumber);
      expect(expected, `missing AnswersInfo for ${question.id}`).toBeDefined();
      expect(runtimeAnswer(question), question.id).toBe(expected);
      comparedOfficial += 1;
    }

    expect(questions).toHaveLength(3120);
    expect(comparedOfficial).toBe(3120);
    expect(skippedSamples).toBe(0);
  });
});
